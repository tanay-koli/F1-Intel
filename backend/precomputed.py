"""
Precomputed race payloads in DuckDB, so telemetry-heavy routes can answer
in milliseconds instead of loading a FastF1 session inside the request.

Table race_payloads(season, round, kind, payload, computed_at, fastf1_version),
one row per (season, round, kind). kind is a route's full response:
- "race_analysis": /api/telemetry/race-analysis (get_full_race_analysis)
- "race_analyst":  /api/race-analyst (services.race.race_analyst)
Payloads are stored as JSON text and returned unchanged.

Single writer: DuckDB lets only one process open a database file read-write,
and while it's open no other process can open it at all (not even
read-only). So the API process owns the file via one shared connection,
opened lazily and guarded by a lock, and the scheduler writes through it.
The CLI (jobs/precompute.py) opens the file only to write a finished result,
and when the API holds it, asks the API to do the work instead.

This is a separate file from the dbt warehouse (warehouse/db/f1.duckdb):
these are finished API payloads, not transforms of raw tables, and keeping
them apart means dbt runs never contend with the API for the write lock.
"""

import json
import logging
import threading
from datetime import UTC, datetime
from pathlib import Path

import duckdb
import fastf1

from settings import settings

logger = logging.getLogger(__name__)

DB_PATH = settings.cache_dir / "precomputed.duckdb"

KINDS = ("race_analysis", "race_analyst")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS race_payloads (
    season         INTEGER NOT NULL,
    round          INTEGER NOT NULL,
    kind           VARCHAR NOT NULL,
    payload        VARCHAR NOT NULL,
    computed_at    TIMESTAMPTZ NOT NULL,
    fastf1_version VARCHAR NOT NULL,
    PRIMARY KEY (season, round, kind)
)
"""


class Store:
    """One DuckDB connection, opened on first use and shared behind a lock."""

    def __init__(self, path: Path = DB_PATH):
        self.path = path
        self._con: duckdb.DuckDBPyConnection | None = None
        self._lock = threading.Lock()

    def _connect(self) -> duckdb.DuckDBPyConnection:
        # Caller holds the lock. Raises duckdb.IOException if another
        # process (e.g. the CLI mid-write) has the file open.
        if self._con is None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            con = duckdb.connect(str(self.path))
            con.execute(_SCHEMA)
            self._con = con
        return self._con

    def read(self, season: int, round_num: int, kind: str) -> dict | None:
        with self._lock:
            row = (
                self._connect()
                .execute(
                    "SELECT payload FROM race_payloads WHERE season = ? AND round = ? AND kind = ?",
                    [season, round_num, kind],
                )
                .fetchone()
            )
        return json.loads(row[0]) if row else None

    def write(self, season: int, round_num: int, kind: str, payload: dict) -> None:
        with self._lock:
            self._connect().execute(
                "INSERT OR REPLACE INTO race_payloads VALUES (?, ?, ?, ?, ?, ?)",
                [
                    season,
                    round_num,
                    kind,
                    json.dumps(payload),
                    datetime.now(UTC),
                    fastf1.__version__,
                ],
            )

    def close(self) -> None:
        with self._lock:
            if self._con is not None:
                self._con.close()
                self._con = None


# The API process's store; the CLI makes its own short-lived one
store = Store()


def read_or_none(season: int, round_num: int, kind: str) -> dict | None:
    """Precomputed payload, or None if missing or the store can't be read right now."""
    try:
        return store.read(season, round_num, kind)
    except duckdb.Error as e:
        # e.g. the CLI holds the file for a moment; the caller falls back to live
        logger.warning("Precomputed store unavailable (%s); using live data", e)
        return None
