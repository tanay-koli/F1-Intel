"""
Ergast F1 API wrapper
Docs: https://ergast.com/mrd/
Base URL: https://ergast.com/api/f1
"""

import json
import sqlite3
import time
import requests
from pathlib import Path
from typing import Optional

BASE_URL = "https://api.jolpi.ca/ergast/f1"
TIMEOUT = 10

# ── SQLite API cache ──────────────────────────────────────────────────────────

_CACHE_DB = Path(__file__).parent / "f1_cache" / "api_cache.sqlite"
_CACHE_DB.parent.mkdir(exist_ok=True)

# TTL in seconds: 1 h for live data, 24 h for static data
_TTL_LIVE   = 3_600       # standings, results, qualifying
_TTL_STATIC = 86_400      # circuits, seasons, schedule

_LIVE_KEYWORDS = ("/driverStandings", "/constructorStandings",
                  "/results", "/qualifying", "/driverStandings")


def _db() -> sqlite3.Connection:
    con = sqlite3.connect(_CACHE_DB)
    con.execute(
        "CREATE TABLE IF NOT EXISTS api_cache "
        "(url TEXT PRIMARY KEY, body TEXT, stored_at REAL)"
    )
    con.commit()
    return con


def _ttl_for(url: str) -> int:
    return _TTL_LIVE if any(k in url for k in _LIVE_KEYWORDS) else _TTL_STATIC

# Constructor brand colors (curated for 2024/2026)
TEAM_COLORS = {
    "red_bull":       "#3671C6",
    "ferrari":        "#E8002D",
    "mercedes":       "#27F4D2",
    "mclaren":        "#FF8000",
    "aston_martin":   "#229971",
    "alpine":         "#0093CC",
    "williams":       "#64C4FF",
    "haas":           "#B6BABD",
    "rb":             "#6692FF",
    "kick_sauber":    "#52E252",
    "sauber":         "#52E252",
    "alphatauri":     "#5E8FAA",
    "alfa":           "#C92D4B",
    "racing_point":   "#F596C8",
    "renault":        "#FFF500",
    "force_india":    "#FF80C7",
    "manor":          "#AE1E22",
    "lotus_f1":       "#FFB800",
    "caterham":       "#005030",
    "marussia":       "#6E0000",
    "hrt":            "#B2945A",
}

TEAM_LOGOS = {
    "red_bull":     "🐂",
    "ferrari":      "🐴",
    "mercedes":     "⭐",
    "mclaren":      "🟠",
    "aston_martin": "🍀",
    "alpine":       "🔵",
    "williams":     "🔷",
    "haas":         "🇺🇸",
    "rb":           "🔵",
    "kick_sauber":  "🟢",
    "sauber":       "🟢",
}

FLAG_MAP = {
    "British":    "🇬🇧", "German":    "🇩🇪", "Dutch":     "🇳🇱",
    "Spanish":    "🇪🇸", "Mexican":   "🇲🇽", "French":    "🇫🇷",
    "Finnish":    "🇫🇮", "Australian":"🇦🇺", "Canadian":  "🇨🇦",
    "Japanese":   "🇯🇵", "Thai":      "🇹🇭", "Chinese":   "🇨🇳",
    "Danish":     "🇩🇰", "American":  "🇺🇸", "Italian":   "🇮🇹",
    "Brazilian":  "🇧🇷", "Austrian":  "🇦🇹", "Swiss":     "🇨🇭",
    "Belgian":    "🇧🇪", "New Zealander": "🇳🇿", "Polish": "🇵🇱",
    "Russian":    "🇷🇺", "Swedish":   "🇸🇪", "Czech":     "🇨🇿",
    "Argentine":  "🇦🇷", "Hungarian": "🇭🇺", "Monegasque":"🇲🇨",
}


def _get(url: str) -> dict:
    """Fetch URL, returning cached response if still fresh."""
    ttl = _ttl_for(url)
    with _db() as con:
        row = con.execute(
            "SELECT body, stored_at FROM api_cache WHERE url = ?", (url,)
        ).fetchone()
        if row:
            body, stored_at = row
            if time.time() - stored_at < ttl:
                return json.loads(body)

    resp = requests.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()

    with _db() as con:
        con.execute(
            "INSERT OR REPLACE INTO api_cache (url, body, stored_at) VALUES (?, ?, ?)",
            (url, json.dumps(data), time.time()),
        )
        con.commit()

    return data


def _team_color(constructor_id: str) -> str:
    return TEAM_COLORS.get(constructor_id, "#E10600")


# ── Drivers ───────────────────────────────────────────────────────────────────

def get_drivers(season: str = "2026") -> dict:
    data = _get(f"{BASE_URL}/{season}/drivers.json?limit=100")
    raw = data["MRData"]["DriverTable"]["Drivers"]

    drivers = []
    for d in raw:
        nationality = d.get("nationality", "")
        drivers.append({
            "driverId":        d["driverId"],
            "code":            d.get("code", ""),
            "number":          d.get("permanentNumber", ""),
            "firstName":       d["givenName"],
            "lastName":        d["familyName"],
            "fullName":        f"{d['givenName']} {d['familyName']}",
            "dateOfBirth":     d.get("dateOfBirth", ""),
            "nationality":     nationality,
            "flag":            FLAG_MAP.get(nationality, "🏁"),
            "url":             d.get("url", ""),
            "season":          season,
        })

    return {"season": season, "drivers": drivers, "total": len(drivers)}


def get_driver_standings(season: str = "2026") -> dict:
    data = _get(f"{BASE_URL}/{season}/driverStandings.json")
    standings_list = data["MRData"]["StandingsTable"]["StandingsLists"]

    if not standings_list:
        return {"season": season, "round": 0, "standings": []}

    raw = standings_list[0]["DriverStandings"]
    standings = []
    for s in raw:
        d = s["Driver"]
        constructors = s.get("Constructors", [{}])
        team = constructors[0] if constructors else {}
        constructor_id = team.get("constructorId", "")
        standings.append({
            "position":       int(s["position"]),
            "points":         float(s["points"]),
            "wins":           int(s["wins"]),
            "driverId":       d["driverId"],
            "code":           d.get("code", ""),
            "number":         d.get("permanentNumber", ""),
            "fullName":       f"{d['givenName']} {d['familyName']}",
            "nationality":    d.get("nationality", ""),
            "flag":           FLAG_MAP.get(d.get("nationality", ""), "🏁"),
            "constructorId":  constructor_id,
            "constructorName":team.get("name", ""),
            "teamColor":      _team_color(constructor_id),
        })

    return {
        "season": season,
        "round": standings_list[0].get("round", 0),
        "standings": standings,
    }


# ── Constructors ──────────────────────────────────────────────────────────────

def get_constructors(season: str = "2026") -> dict:
    data = _get(f"{BASE_URL}/{season}/constructors.json?limit=50")
    raw = data["MRData"]["ConstructorTable"]["Constructors"]

    constructors = []
    for c in raw:
        cid = c["constructorId"]
        nat = c.get("nationality", "")
        constructors.append({
            "constructorId": cid,
            "name":          c["name"],
            "nationality":   nat,
            "flag":          FLAG_MAP.get(nat, "🏁"),
            "url":           c.get("url", ""),
            "color":         _team_color(cid),
            "season":        season,
        })

    return {"season": season, "constructors": constructors, "total": len(constructors)}


def get_constructor_standings(season: str = "2026") -> dict:
    data = _get(f"{BASE_URL}/{season}/constructorStandings.json")
    standings_list = data["MRData"]["StandingsTable"]["StandingsLists"]

    if not standings_list:
        return {"season": season, "round": 0, "standings": []}

    raw = standings_list[0]["ConstructorStandings"]
    standings = []
    for s in raw:
        c = s["Constructor"]
        cid = c["constructorId"]
        nat = c.get("nationality", "")
        standings.append({
            "position":       int(s["position"]),
            "points":         float(s["points"]),
            "wins":           int(s["wins"]),
            "constructorId":  cid,
            "name":           c["name"],
            "nationality":    nat,
            "flag":           FLAG_MAP.get(nat, "🏁"),
            "color":          _team_color(cid),
        })

    return {
        "season": season,
        "round": standings_list[0].get("round", 0),
        "standings": standings,
    }


# ── Circuits ──────────────────────────────────────────────────────────────────

def get_circuits(season: str = "2026") -> dict:
    data = _get(f"{BASE_URL}/{season}/circuits.json?limit=30")
    raw = data["MRData"]["CircuitTable"]["Circuits"]

    circuits = []
    for c in raw:
        loc = c.get("Location", {})
        country = loc.get("country", "")
        circuits.append({
            "circuitId":   c["circuitId"],
            "name":        c["circuitName"],
            "locality":    loc.get("locality", ""),
            "country":     country,
            "flag":        FLAG_MAP.get(country, "🏁"),
            "lat":         float(loc.get("lat", 0)),
            "lng":         float(loc.get("long", 0)),
            "url":         c.get("url", ""),
            "season":      season,
        })

    return {"season": season, "circuits": circuits, "total": len(circuits)}


# ── Seasons ───────────────────────────────────────────────────────────────────

def get_seasons() -> dict:
    data = _get(f"{BASE_URL}/seasons.json?limit=100&offset=65")
    raw = data["MRData"]["SeasonTable"]["Seasons"]
    seasons = [s["season"] for s in reversed(raw)]
    return {"seasons": seasons}


# ── Race Schedule ─────────────────────────────────────────────────────────────

def get_schedule(season: str = "2026") -> dict:
    data = _get(f"{BASE_URL}/{season}.json?limit=30")
    raw = data["MRData"]["RaceTable"]["Races"]

    races = []
    for r in raw:
        circuit = r.get("Circuit", {})
        loc = circuit.get("Location", {})
        country = loc.get("country", "")
        races.append({
            "round":       int(r["round"]),
            "raceName":    r["raceName"],
            "season":      r["season"],
            "date":        r.get("date", ""),
            "time":        r.get("time", ""),
            "circuitId":   circuit.get("circuitId", ""),
            "circuitName": circuit.get("circuitName", ""),
            "locality":    loc.get("locality", ""),
            "country":     country,
            "flag":        FLAG_MAP.get(country, "🏁"),
            "lat":         float(loc.get("lat", 0)),
            "lng":         float(loc.get("long", 0)),
            # nested session times if present
            "fp1":         r.get("FirstPractice", {}).get("date", ""),
            "fp2":         r.get("SecondPractice", {}).get("date", ""),
            "fp3":         r.get("ThirdPractice", {}).get("date", ""),
            "qualifying":  r.get("Qualifying", {}).get("date", ""),
            "sprint":      r.get("Sprint", {}).get("date", ""),
        })

    return {"season": season, "total": len(races), "races": races}


# ── Race Results ──────────────────────────────────────────────────────────────

def get_race_results(season: str = "2026", round_num: str = "last") -> dict:
    data = _get(f"{BASE_URL}/{season}/{round_num}/results.json?limit=30")
    races = data["MRData"]["RaceTable"]["Races"]
    if not races:
        return {"season": season, "round": round_num, "results": []}

    race = races[0]
    results = []
    for r in race["Results"]:
        driver = r["Driver"]
        constructor = r.get("Constructor", {})
        cid = constructor.get("constructorId", "")
        nat = driver.get("nationality", "")
        fastest = r.get("FastestLap", {})
        results.append({
            "position":       int(r["position"]) if r["position"].isdigit() else 99,
            "positionText":   r.get("positionText", r["position"]),
            "points":         float(r.get("points", 0)),
            "grid":           int(r.get("grid", 0)),
            "laps":           int(r.get("laps", 0)),
            "status":         r.get("status", ""),
            "driverId":       driver["driverId"],
            "code":           driver.get("code", ""),
            "number":         driver.get("permanentNumber", ""),
            "fullName":       f"{driver['givenName']} {driver['familyName']}",
            "nationality":    nat,
            "flag":           FLAG_MAP.get(nat, "🏁"),
            "constructorId":  cid,
            "constructorName":constructor.get("name", ""),
            "teamColor":      _team_color(cid),
            "time":           r.get("Time", {}).get("time", ""),
            "fastestLapTime": fastest.get("Time", {}).get("time", ""),
            "fastestLapRank": int(fastest.get("rank", 99)) if fastest else 99,
            "fastestLapSpeed":fastest.get("AverageSpeed", {}).get("speed", ""),
        })

    circuit = race.get("Circuit", {})
    loc = circuit.get("Location", {})
    return {
        "season":      race["season"],
        "round":       int(race["round"]),
        "raceName":    race["raceName"],
        "date":        race.get("date", ""),
        "circuitId":   circuit.get("circuitId", ""),
        "circuitName": circuit.get("circuitName", ""),
        "country":     loc.get("country", ""),
        "flag":        FLAG_MAP.get(loc.get("country", ""), "🏁"),
        "results":     results,
    }


# ── Qualifying Results ────────────────────────────────────────────────────────

def get_qualifying(season: str = "2026", round_num: str = "last") -> dict:
    data = _get(f"{BASE_URL}/{season}/{round_num}/qualifying.json?limit=30")
    races = data["MRData"]["RaceTable"]["Races"]
    if not races:
        return {"season": season, "round": round_num, "results": []}

    race = races[0]
    results = []
    for r in race.get("QualifyingResults", []):
        driver = r["Driver"]
        constructor = r.get("Constructor", {})
        cid = constructor.get("constructorId", "")
        nat = driver.get("nationality", "")
        results.append({
            "position":       int(r["position"]),
            "driverId":       driver["driverId"],
            "code":           driver.get("code", ""),
            "number":         driver.get("permanentNumber", ""),
            "fullName":       f"{driver['givenName']} {driver['familyName']}",
            "nationality":    nat,
            "flag":           FLAG_MAP.get(nat, "🏁"),
            "constructorId":  cid,
            "constructorName":constructor.get("name", ""),
            "teamColor":      _team_color(cid),
            "q1":             r.get("Q1", "—"),
            "q2":             r.get("Q2", "—"),
            "q3":             r.get("Q3", "—"),
        })

    circuit = race.get("Circuit", {})
    loc = circuit.get("Location", {})
    return {
        "season":      race["season"],
        "round":       int(race["round"]),
        "raceName":    race["raceName"],
        "date":        race.get("date", ""),
        "circuitName": circuit.get("circuitName", ""),
        "country":     loc.get("country", ""),
        "flag":        FLAG_MAP.get(loc.get("country", ""), "🏁"),
        "results":     results,
    }


# ── Points Progression ────────────────────────────────────────────────────────

def get_driver_points_progression(season: str = "2026") -> dict:
    """
    Returns cumulative points per driver after each race.
    Fetches all round standings in sequence (one call per completed round).
    """
    # first get total rounds completed
    sched = get_schedule(season)
    from datetime import date
    today = date.today().isoformat()
    completed = [r for r in sched["races"] if r["date"] <= today]
    total_rounds = len(completed)

    if total_rounds == 0:
        return {"season": season, "rounds": [], "series": []}

    # fetch standings after each round (parallel-ish via list)
    rounds_data = []
    for rnd in range(1, total_rounds + 1):
        try:
            data = _get(f"{BASE_URL}/{season}/{rnd}/driverStandings.json")
            slist = data["MRData"]["StandingsTable"]["StandingsLists"]
            if slist:
                rounds_data.append(slist[0])
        except Exception:
            pass

    if not rounds_data:
        return {"season": season, "rounds": [], "series": []}

    # collect all driver ids
    all_driver_ids = set()
    for rnd in rounds_data:
        for s in rnd["DriverStandings"]:
            all_driver_ids.add(s["Driver"]["driverId"])

    # build series: {driverId: {code, color, points: [r1, r2, ...]}}
    series_map = {}
    for rnd in rounds_data:
        standings = {s["Driver"]["driverId"]: s for s in rnd["DriverStandings"]}
        for did in all_driver_ids:
            if did not in series_map:
                s = standings.get(did)
                if s:
                    d = s["Driver"]
                    teams = s.get("Constructors", [{}])
                    cid = teams[0].get("constructorId", "") if teams else ""
                    series_map[did] = {
                        "driverId": did,
                        "code":     d.get("code", did[:3].upper()),
                        "fullName": f"{d['givenName']} {d['familyName']}",
                        "teamColor":_team_color(cid),
                        "points":   [],
                    }
            entry = standings.get(did)
            if did not in series_map:
                continue  # driver not yet seen in any round
            pts = float(entry["points"]) if entry else (series_map[did]["points"][-1] if series_map[did]["points"] else 0)
            series_map[did]["points"].append(pts)

    round_labels = [f"R{r['round']}" for r in rounds_data]
    # keep only top 10 in final standing
    final_pts = {did: v["points"][-1] for did, v in series_map.items()}
    top10 = sorted(final_pts, key=lambda x: -final_pts[x])[:10]
    series = [series_map[did] for did in top10]

    return {"season": season, "rounds": round_labels, "series": series}


# ── Constructor Points Progression ────────────────────────────────────────────

def get_constructor_points_progression(season: str = "2026") -> dict:
    sched = get_schedule(season)
    from datetime import date
    today = date.today().isoformat()
    completed = [r for r in sched["races"] if r["date"] <= today]
    total_rounds = len(completed)

    if total_rounds == 0:
        return {"season": season, "rounds": [], "series": []}

    rounds_data = []
    for rnd in range(1, total_rounds + 1):
        try:
            data = _get(f"{BASE_URL}/{season}/{rnd}/constructorStandings.json")
            slist = data["MRData"]["StandingsTable"]["StandingsLists"]
            if slist:
                rounds_data.append(slist[0])
        except Exception:
            pass

    if not rounds_data:
        return {"season": season, "rounds": [], "series": []}

    all_cids = set()
    for rnd in rounds_data:
        for s in rnd["ConstructorStandings"]:
            all_cids.add(s["Constructor"]["constructorId"])

    series_map = {}
    for rnd in rounds_data:
        standings = {s["Constructor"]["constructorId"]: s for s in rnd["ConstructorStandings"]}
        for cid in all_cids:
            if cid not in series_map:
                s = standings.get(cid)
                if s:
                    c = s["Constructor"]
                    series_map[cid] = {
                        "constructorId": cid,
                        "name":     c["name"],
                        "color":    _team_color(cid),
                        "points":   [],
                    }
            entry = standings.get(cid)
            if cid not in series_map:
                continue  # constructor not yet seen
            pts = float(entry["points"]) if entry else (series_map[cid]["points"][-1] if series_map[cid]["points"] else 0)
            series_map[cid]["points"].append(pts)

    round_labels = [f"R{r['round']}" for r in rounds_data]
    final_pts = {cid: v["points"][-1] for cid, v in series_map.items()}
    sorted_cids = sorted(final_pts, key=lambda x: -final_pts[x])
    series = [series_map[cid] for cid in sorted_cids]

    return {"season": season, "rounds": round_labels, "series": series}


# ── Sprint Results ─────────────────────────────────────────────────────────────

def get_sprint_results(season: str = "2026", round_num: str = "last") -> dict:
    data = _get(f"{BASE_URL}/{season}/{round_num}/sprint.json?limit=30")
    races = data["MRData"]["RaceTable"]["Races"]
    if not races:
        return {"season": season, "round": round_num, "results": []}

    race = races[0]
    results = []
    for r in race.get("SprintResults", []):
        driver = r["Driver"]
        constructor = r.get("Constructor", {})
        cid = constructor.get("constructorId", "")
        nat = driver.get("nationality", "")
        fastest = r.get("FastestLap", {})
        pos_str = str(r["position"])
        results.append({
            "position":        int(pos_str) if pos_str.isdigit() else 99,
            "positionText":    r.get("positionText", pos_str),
            "points":          float(r.get("points", 0)),
            "grid":            int(r.get("grid", 0)),
            "laps":            int(r.get("laps", 0)),
            "status":          r.get("status", ""),
            "driverId":        driver["driverId"],
            "code":            driver.get("code", ""),
            "number":          driver.get("permanentNumber", ""),
            "fullName":        f"{driver['givenName']} {driver['familyName']}",
            "nationality":     nat,
            "flag":            FLAG_MAP.get(nat, "🏁"),
            "constructorId":   cid,
            "constructorName": constructor.get("name", ""),
            "teamColor":       _team_color(cid),
            "time":            r.get("Time", {}).get("time", ""),
            "fastestLapTime":  fastest.get("Time", {}).get("time", "") if fastest else "",
            "fastestLapRank":  int(fastest.get("rank", 99)) if fastest else 99,
        })

    circuit = race.get("Circuit", {})
    loc = circuit.get("Location", {})
    return {
        "season":      race["season"],
        "round":       int(race["round"]),
        "raceName":    race["raceName"],
        "date":        race.get("date", ""),
        "circuitId":   circuit.get("circuitId", ""),
        "circuitName": circuit.get("circuitName", ""),
        "country":     loc.get("country", ""),
        "flag":        FLAG_MAP.get(loc.get("country", ""), "🏁"),
        "results":     results,
    }


# ── Pit Stops ─────────────────────────────────────────────────────────────────

def _parse_duration(raw: str) -> float:
    """Parse pit stop duration string '23.456' or '1:03.456' to seconds."""
    try:
        raw = str(raw).replace(",", ".")
        if ":" in raw:
            parts = raw.split(":")
            return round(int(parts[0]) * 60 + float(parts[1]), 3)
        return round(float(raw), 3)
    except Exception:
        return 0.0


def get_pit_stops(season: str = "2026", round_num: str = "last") -> dict:
    data = _get(f"{BASE_URL}/{season}/{round_num}/pitstops.json?limit=100")
    races = data["MRData"]["RaceTable"]["Races"]
    if not races:
        return {"season": season, "round": round_num, "totalLaps": 0, "pitstops": []}

    race = races[0]
    actual_round = str(race["round"])

    # Enrich with race results for driver names / team colors / finish order
    driver_info: dict = {}
    total_laps = 0
    try:
        res = get_race_results(season, actual_round)
        total_laps = max((r["laps"] for r in res["results"]), default=0)
        driver_info = {r["driverId"]: r for r in res["results"]}
    except Exception:
        pass

    pitstops = []
    for ps in race.get("PitStops", []):
        did = ps["driverId"]
        info = driver_info.get(did, {})
        pitstops.append({
            "driverId":        did,
            "code":            info.get("code", did[:3].upper()),
            "fullName":        info.get("fullName", did),
            "teamColor":       info.get("teamColor", "#888888"),
            "constructorName": info.get("constructorName", ""),
            "finishPosition":  info.get("position", 99),
            "stop":            int(ps["stop"]),
            "lap":             int(ps["lap"]),
            "time":            ps.get("time", ""),
            "duration":        _parse_duration(ps.get("duration", "0")),
        })

    # Fallback total laps from pit stop data if race results unavailable
    if not total_laps and pitstops:
        total_laps = max(ps["lap"] for ps in pitstops)

    circuit = race.get("Circuit", {})
    loc = circuit.get("Location", {})
    return {
        "season":    race["season"],
        "round":     int(race["round"]),
        "raceName":  race["raceName"],
        "date":      race.get("date", ""),
        "country":   loc.get("country", ""),
        "flag":      FLAG_MAP.get(loc.get("country", ""), "🏁"),
        "totalLaps": total_laps,
        "pitstops":  pitstops,
    }


# ── Driver Season Results (for H2H) ──────────────────────────────────────────

def get_driver_season_results(season: str = "2026", driver_id: str = "") -> dict:
    data = _get(f"{BASE_URL}/{season}/drivers/{driver_id}/results.json?limit=30")
    races = data["MRData"]["RaceTable"]["Races"]

    driver_meta: dict = {}
    results = []
    for race in races:
        if not race.get("Results"):
            continue
        r = race["Results"][0]
        d = r["Driver"]
        constructor = r.get("Constructor", {})
        cid = constructor.get("constructorId", "")
        nat = d.get("nationality", "")

        if not driver_meta:
            driver_meta = {
                "driverId":        d["driverId"],
                "fullName":        f"{d['givenName']} {d['familyName']}",
                "code":            d.get("code", ""),
                "flag":            FLAG_MAP.get(nat, "🏁"),
                "constructorId":   cid,
                "constructorName": constructor.get("name", ""),
                "teamColor":       _team_color(cid),
            }

        pos_str = str(r["position"])
        pos_int = int(pos_str) if pos_str.isdigit() else 99
        fastest = r.get("FastestLap", {})
        results.append({
            "round":           int(race["round"]),
            "raceName":        race["raceName"],
            "date":            race.get("date", ""),
            "position":        pos_int,
            "positionText":    r.get("positionText", pos_str),
            "points":          float(r.get("points", 0)),
            "grid":            int(r.get("grid", 0)),
            "laps":            int(r.get("laps", 0)),
            "status":          r.get("status", ""),
            "constructorId":   cid,
            "constructorName": constructor.get("name", ""),
            "teamColor":       _team_color(cid),
            "fastestLapRank":  int(fastest.get("rank", 99)) if fastest else 99,
            "time":            r.get("Time", {}).get("time", ""),
        })

    return {"season": season, "driver": driver_meta, "results": results}


def get_driver_season_sprint_results(season: str = "2026", driver_id: str = "") -> list:
    """Fetch sprint race results and points for a driver in a season."""
    try:
        data = _get(f"{BASE_URL}/{season}/drivers/{driver_id}/sprint.json?limit=30")
        races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
        results = []
        for race in races:
            if not race.get("SprintResults"):
                continue
            r = race["SprintResults"][0]
            pos_str = str(r["position"])
            pos_int = int(pos_str) if pos_str.isdigit() else 99
            results.append({
                "round":    int(race["round"]),
                "points":   float(r.get("points", 0)),
                "position": pos_int,
                "status":   r.get("status", ""),
            })
        return results
    except Exception:
        return []


def get_driver_season_qualifying(season: str = "2026", driver_id: str = "") -> list:
    """Fetch qualifying results for a driver across an entire season."""
    try:
        data = _get(f"{BASE_URL}/{season}/drivers/{driver_id}/qualifying.json?limit=30")
        races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
        results = []
        for race in races:
            if not race.get("QualifyingResults"):
                continue
            r = race["QualifyingResults"][0]
            pos_str = str(r["position"])
            results.append({
                "round":    int(race["round"]),
                "position": int(pos_str) if pos_str.isdigit() else 99,
                "q1":       r.get("Q1", ""),
                "q2":       r.get("Q2", ""),
                "q3":       r.get("Q3", ""),
            })
        return results
    except Exception:
        return []
