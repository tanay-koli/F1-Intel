"""warehouse/ingest/ingest_jolpica.py: a failed season keeps its previous rows."""

import importlib.util
import sys
import types
from pathlib import Path

import duckdb
import pytest

INGEST = Path(__file__).resolve().parent.parent / "warehouse" / "ingest" / "ingest_jolpica.py"


@pytest.fixture
def ingest(monkeypatch):
    # tqdm is a warehouse-only dependency; the tests don't install it
    monkeypatch.setitem(sys.modules, "tqdm", types.SimpleNamespace(tqdm=lambda it, **_: it))
    spec = importlib.util.spec_from_file_location("ingest_jolpica", INGEST)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(module.time, "sleep", lambda _: None)
    return module


def test_failed_season_rolls_back(ingest, monkeypatch):
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE raw_schedule (season INT, round INT, race_name VARCHAR,"
        " circuit_id VARCHAR, circuit_name VARCHAR, locality VARCHAR, country VARCHAR,"
        " lat DOUBLE, lng DOUBLE, date VARCHAR, time VARCHAR)"
    )
    con.execute("INSERT INTO raw_schedule VALUES (2000, 1, 'old', 'c', 'c', '', '', 0, 0, '', '')")

    race = {"season": "2000", "round": "1", "raceName": "new", "Circuit": {"circuitId": "c"}}
    schedule = {"MRData": {"RaceTable": {"Races": [race]}}}

    def fetch(url):
        # The schedule loads (and replaces the old rows), then results fail
        if url.endswith("2000.json?limit=30"):
            return schedule
        raise RuntimeError("network down")

    monkeypatch.setattr(ingest, "fetch", fetch)
    assert ingest.ingest_seasons([2000], con) == [2000]
    assert con.execute("SELECT race_name FROM raw_schedule").fetchall() == [("old",)]
