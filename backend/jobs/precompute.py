"""
Precompute a race's analysis and analyst payloads into the precomputed store.

Run on demand from backend/:
    python -m jobs.precompute --season 2022 --round 16

The API also runs precompute_race() on a schedule (jobs/scheduler.py).

Because DuckDB allows one process at a time on the file (see precomputed.py),
the CLI computes first and then opens the store only to write. If the
running API holds the file, the CLI asks the API to do the job
(POST /api/admin/precompute, accepted from localhost only); the API reloads
the session from FastF1's disk cache, which this run just filled.
"""

import argparse
import sys

import duckdb
import requests

from errors import AppError
from precomputed import KINDS, Store
from services.race import build_race_analyst
from settings import settings
from telemetry import get_full_race_analysis


def compute(year: int, round_num: int) -> dict[str, dict]:
    """Both payloads for a race, computed live (raises AppError if data is missing)."""
    analysis = get_full_race_analysis(year, round_num)
    return {
        "race_analysis": analysis,
        "race_analyst": build_race_analyst(year, round_num, analysis),
    }


def precompute_race(year: int, round_num: int, store: Store) -> dict:
    """Compute and store a race's payloads; returns a summary."""
    payloads = compute(year, round_num)
    for kind in KINDS:
        store.write(year, round_num, kind, payloads[kind])
    return {"season": year, "round": round_num, "stored": list(KINDS)}


def _write_locally(year: int, round_num: int, payloads: dict[str, dict]) -> dict:
    store = Store()
    try:
        for kind in KINDS:
            store.write(year, round_num, kind, payloads[kind])
    finally:
        store.close()
    return {"season": year, "round": round_num, "stored": list(KINDS)}


def _ask_api(year: int, round_num: int, api_url: str) -> dict:
    r = requests.post(
        f"{api_url}/api/admin/precompute",
        params={"year": year, "round": round_num},
        timeout=600,
    )
    body = r.json()
    if r.status_code != 200:
        raise RuntimeError(body.get("message", r.text))
    return body


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Precompute race analysis into the precomputed store.")
    ap.add_argument("--season", type=int, required=True)
    ap.add_argument("--round", type=int, required=True)
    ap.add_argument("--api", default=settings.api_url, help="running API to delegate to if locked")
    args = ap.parse_args(argv)

    try:
        payloads = compute(args.season, args.round)
    except AppError as e:
        print(f"Can't precompute {args.season} R{args.round}: {e.message}", file=sys.stderr)
        return 1

    try:
        result = _write_locally(args.season, args.round, payloads)
        where = "written directly"
    except duckdb.IOException:
        # The API process has the file open; it is the only allowed writer
        try:
            result = _ask_api(args.season, args.round, args.api)
        except (requests.RequestException, RuntimeError) as e:
            print(
                f"Store is locked and the API at {args.api} didn't take the job: {e}",
                file=sys.stderr,
            )
            return 1
        where = f"written by the running API ({args.api})"

    print(f"{result['season']} R{result['round']}: stored {', '.join(result['stored'])} ({where})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
