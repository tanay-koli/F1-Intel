"""
Bulk historical ingest from Jolpica/Ergast API into DuckDB.
Run once, then incrementally after each race weekend.

Usage:
    python ingest_jolpica.py --seasons 1950-2025
    python ingest_jolpica.py --seasons 2025        # single season top-up
"""

import argparse
import time
from pathlib import Path

import duckdb
import requests
from tqdm import tqdm

DB_PATH = Path(__file__).parent.parent / "db" / "f1.duckdb"
RAW_PATH = Path(__file__).parent.parent / "raw" / "jolpica"
BASE_URL = "https://api.jolpi.ca/ergast/f1"  # Jolpica mirror
SLEEP = 0.2  # be polite — Jolpica rate limit is 200 req/hour


def fetch(url: str) -> dict:
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=15)
            r.raise_for_status()
            return r.json()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2**attempt)


def ingest_season(season: int, con: duckdb.DuckDBPyConnection):
    print(f"\n── Season {season} ──────────────────────────────")

    # ── 1. Race schedule ──────────────────────────────────────────
    data = fetch(f"{BASE_URL}/{season}.json?limit=30")
    races = data["MRData"]["RaceTable"]["Races"]
    if not races:
        print(f"  No races found for {season}, skipping.")
        return

    con.execute("""
        CREATE TABLE IF NOT EXISTS raw_schedule (
            season INT, round INT, race_name VARCHAR,
            circuit_id VARCHAR, circuit_name VARCHAR,
            locality VARCHAR, country VARCHAR,
            lat DOUBLE, lng DOUBLE, date VARCHAR, time VARCHAR
        )
    """)
    con.execute("DELETE FROM raw_schedule WHERE season = ?", [season])
    for r in races:
        loc = r["Circuit"].get("Location", {})
        con.execute(
            "INSERT INTO raw_schedule VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            [
                int(r["season"]),
                int(r["round"]),
                r["raceName"],
                r["Circuit"]["circuitId"],
                r["Circuit"]["circuitName"],
                loc.get("locality", ""),
                loc.get("country", ""),
                float(loc.get("lat", 0) or 0),
                float(loc.get("long", 0) or 0),
                r.get("date", ""),
                r.get("time", ""),
            ],
        )
    print(f"  ✓ schedule  ({len(races)} races)")
    time.sleep(SLEEP)

    # ── 2. Race results (all rounds) ──────────────────────────────
    con.execute("""
        CREATE TABLE IF NOT EXISTS raw_results (
            season INT, round INT, race_name VARCHAR,
            circuit_id VARCHAR,
            position INT, position_text VARCHAR,
            driver_id VARCHAR, driver_code VARCHAR,
            driver_name VARCHAR, driver_nationality VARCHAR,
            constructor_id VARCHAR, constructor_name VARCHAR,
            grid INT, laps INT, status VARCHAR,
            points DOUBLE, time VARCHAR,
            fastest_lap_rank INT, fastest_lap_time VARCHAR,
            fastest_lap_speed VARCHAR
        )
    """)
    con.execute("DELETE FROM raw_results WHERE season = ?", [season])

    total_results = 0
    for race in tqdm(races, desc=f"  results {season}", leave=False):
        rnd = race["round"]
        data = fetch(f"{BASE_URL}/{season}/{rnd}/results.json?limit=30")
        race_data = data["MRData"]["RaceTable"]["Races"]
        if not race_data:
            continue
        for r in race_data[0].get("Results", []):
            d = r["Driver"]
            c = r.get("Constructor", {})
            fl = r.get("FastestLap", {})
            pos = str(r.get("position", "99"))
            con.execute(
                "INSERT INTO raw_results VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                [
                    season,
                    int(rnd),
                    race["raceName"],
                    race["Circuit"]["circuitId"],
                    int(pos) if pos.isdigit() else 99,
                    r.get("positionText", pos),
                    d["driverId"],
                    d.get("code", ""),
                    f"{d['givenName']} {d['familyName']}",
                    d.get("nationality", ""),
                    c.get("constructorId", ""),
                    c.get("name", ""),
                    int(r.get("grid", 0)),
                    int(r.get("laps", 0)),
                    r.get("status", ""),
                    float(r.get("points", 0)),
                    r.get("Time", {}).get("time", ""),
                    int(fl.get("rank", 99)) if fl else 99,
                    fl.get("Time", {}).get("time", "") if fl else "",
                    fl.get("AverageSpeed", {}).get("speed", "") if fl else "",
                ],
            )
            total_results += 1
        time.sleep(SLEEP)
    print(f"  ✓ results   ({total_results} rows)")

    # ── 3. Qualifying ─────────────────────────────────────────────
    con.execute("""
        CREATE TABLE IF NOT EXISTS raw_qualifying (
            season INT, round INT, race_name VARCHAR,
            circuit_id VARCHAR,
            position INT, driver_id VARCHAR, driver_code VARCHAR,
            driver_name VARCHAR, constructor_id VARCHAR,
            q1 VARCHAR, q2 VARCHAR, q3 VARCHAR
        )
    """)
    con.execute("DELETE FROM raw_qualifying WHERE season = ?", [season])

    total_qual = 0
    for race in tqdm(races, desc=f"  qualifying {season}", leave=False):
        rnd = race["round"]
        data = fetch(f"{BASE_URL}/{season}/{rnd}/qualifying.json?limit=30")
        race_data = data["MRData"]["RaceTable"]["Races"]
        if not race_data:
            continue
        for r in race_data[0].get("QualifyingResults", []):
            d = r["Driver"]
            c = r.get("Constructor", {})
            con.execute(
                "INSERT INTO raw_qualifying VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                [
                    season,
                    int(rnd),
                    race["raceName"],
                    race["Circuit"]["circuitId"],
                    int(r.get("position", 99)),
                    d["driverId"],
                    d.get("code", ""),
                    f"{d['givenName']} {d['familyName']}",
                    c.get("constructorId", ""),
                    r.get("Q1", ""),
                    r.get("Q2", ""),
                    r.get("Q3", ""),
                ],
            )
            total_qual += 1
        time.sleep(SLEEP)
    print(f"  ✓ qualifying ({total_qual} rows)")

    # ── 4. Pit stops ──────────────────────────────────────────────
    con.execute("""
        CREATE TABLE IF NOT EXISTS raw_pitstops (
            season INT, round INT, driver_id VARCHAR,
            stop_number INT, lap INT,
            local_time VARCHAR, duration VARCHAR
        )
    """)
    con.execute("DELETE FROM raw_pitstops WHERE season = ?", [season])

    total_pits = 0
    for race in tqdm(races, desc=f"  pitstops   {season}", leave=False):
        rnd = race["round"]
        # pit stops only available from 2011
        if season < 2011:
            break
        data = fetch(f"{BASE_URL}/{season}/{rnd}/pitstops.json?limit=100")
        race_data = data["MRData"]["RaceTable"]["Races"]
        if not race_data:
            continue
        for p in race_data[0].get("PitStops", []):
            con.execute(
                "INSERT INTO raw_pitstops VALUES (?,?,?,?,?,?,?)",
                [
                    season,
                    int(rnd),
                    p.get("driverId", ""),
                    int(p.get("stop", 0)),
                    int(p.get("lap", 0)),
                    p.get("time", ""),
                    p.get("duration", ""),
                ],
            )
            total_pits += 1
        time.sleep(SLEEP)
    print(f"  ✓ pit stops ({total_pits} rows)")

    # ── 5. Driver standings (per round) ───────────────────────────
    con.execute("""
        CREATE TABLE IF NOT EXISTS raw_driver_standings (
            season INT, round INT,
            position INT, driver_id VARCHAR,
            driver_name VARCHAR, constructor_id VARCHAR,
            points DOUBLE, wins INT
        )
    """)
    con.execute("DELETE FROM raw_driver_standings WHERE season = ?", [season])

    for race in tqdm(races, desc=f"  standings  {season}", leave=False):
        rnd = race["round"]
        data = fetch(f"{BASE_URL}/{season}/{rnd}/driverStandings.json")
        slist = data["MRData"]["StandingsTable"]["StandingsLists"]
        if not slist:
            continue
        for s in slist[0].get("DriverStandings", []):
            d = s.get("Driver", {})
            cs = s.get("Constructors", [{}])
            con.execute(
                "INSERT INTO raw_driver_standings VALUES (?,?,?,?,?,?,?,?)",
                [
                    season,
                    int(rnd),
                    int(s.get("position", 99)),
                    d.get("driverId", ""),
                    f"{d.get('givenName', '')} {d.get('familyName', '')}".strip(),
                    cs[0].get("constructorId", "") if cs else "",
                    float(s.get("points", 0)),
                    int(s.get("wins", 0)),
                ],
            )
        time.sleep(SLEEP)
    print("  ✓ standings (driver)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", default="2024-2025", help="e.g. '1950-2025' or single '2025'")
    args = parser.parse_args()

    if "-" in args.seasons:
        start, end = args.seasons.split("-")
        seasons = list(range(int(start), int(end) + 1))
    else:
        seasons = [int(args.seasons)]

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB_PATH))

    print(f"🏎  Ingesting {len(seasons)} seasons into {DB_PATH}")
    for season in seasons:
        try:
            ingest_season(season, con)
        except Exception as e:
            print(f"  ✗ season {season} failed: {e}")

    # Quick summary
    print("\n── Summary ──────────────────────────────────────")
    for tbl in [
        "raw_schedule",
        "raw_results",
        "raw_qualifying",
        "raw_pitstops",
        "raw_driver_standings",
    ]:
        try:
            n = con.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
            print(f"  {tbl:<30} {n:>8} rows")
        except duckdb.Error:
            pass  # table not created (no data for that kind)

    con.close()
    print("\n✅ Ingest complete")
