"""
Jolpica F1 API wrapper (https://github.com/jolpica/jolpica-f1).

Jolpica is the maintained, Ergast-compatible successor to the retired Ergast
API: same URL layout and MRData response format, served from
https://api.jolpi.ca/ergast/f1. The module keeps its historical name.
"""

import json
import logging
import sqlite3
import time
from datetime import UTC, date, datetime

import requests

import cache_policy
from errors import NotFound, RateLimited, UpstreamError
from settings import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.jolpi.ca/ergast/f1"
TIMEOUT = 10

# ── SQLite API cache ──────────────────────────────────────────────────────────

# Raw Jolpica responses keyed by URL. How long each stays fresh is decided
# from the data itself (past season, finished round, live weekend), see
# cache_policy.py and is_fresh() below.
_CACHE_DB = settings.cache_dir / "api_cache.sqlite"
_CACHE_DB.parent.mkdir(parents=True, exist_ok=True)


def _db() -> sqlite3.Connection:
    con = sqlite3.connect(_CACHE_DB)
    con.execute(
        "CREATE TABLE IF NOT EXISTS api_cache (url TEXT PRIMARY KEY, body TEXT, stored_at REAL)"
    )
    con.commit()
    return con


# Constructor brand colors (curated for 2024/2026)
TEAM_COLORS = {
    "red_bull": "#3671C6",
    "ferrari": "#E8002D",
    "mercedes": "#27F4D2",
    "mclaren": "#FF8000",
    "aston_martin": "#229971",
    "alpine": "#0093CC",
    "williams": "#64C4FF",
    "haas": "#B6BABD",
    "rb": "#6692FF",
    "kick_sauber": "#52E252",
    "sauber": "#52E252",
    "alphatauri": "#5E8FAA",
    "alfa": "#C92D4B",
    "racing_point": "#F596C8",
    "renault": "#FFF500",
    "force_india": "#FF80C7",
    "manor": "#AE1E22",
    "lotus_f1": "#FFB800",
    "caterham": "#005030",
    "marussia": "#6E0000",
    "hrt": "#B2945A",
}

FLAG_MAP = {
    "British": "🇬🇧",
    "German": "🇩🇪",
    "Dutch": "🇳🇱",
    "Spanish": "🇪🇸",
    "Mexican": "🇲🇽",
    "French": "🇫🇷",
    "Finnish": "🇫🇮",
    "Australian": "🇦🇺",
    "Canadian": "🇨🇦",
    "Japanese": "🇯🇵",
    "Thai": "🇹🇭",
    "Chinese": "🇨🇳",
    "Danish": "🇩🇰",
    "American": "🇺🇸",
    "Italian": "🇮🇹",
    "Brazilian": "🇧🇷",
    "Austrian": "🇦🇹",
    "Swiss": "🇨🇭",
    "Belgian": "🇧🇪",
    "New Zealander": "🇳🇿",
    "Polish": "🇵🇱",
    "Russian": "🇷🇺",
    "Swedish": "🇸🇪",
    "Czech": "🇨🇿",
    "Argentine": "🇦🇷",
    "Hungarian": "🇭🇺",
    "Monegasque": "🇲🇨",
}


def _cached_races(con: sqlite3.Connection, season: str, now: datetime) -> list | None:
    """A season's raw schedule from the cache (any age), for the TTL policy."""
    seasons = {season, str(now.year)} if season == "current" else {season}
    for s in seasons:
        row = con.execute(
            "SELECT body FROM api_cache WHERE url = ?", (f"{BASE_URL}/{s}.json?limit=30",)
        ).fetchone()
        if row:
            return json.loads(row[0])["MRData"]["RaceTable"]["Races"]
    return None


def is_fresh(con: sqlite3.Connection, url: str, body: dict, stored_at: float) -> bool:
    """Whether a cached response is still usable; see cache_policy for the rules."""
    now = datetime.now(UTC)
    season, _ = cache_policy.parse(url, BASE_URL)
    if season and season.isdigit() and int(season) < now.year:
        return True  # past seasons never expire; skip reading the schedule
    races = _cached_races(con, season, now) if season else None
    ttl = cache_policy.ttl_for(url, now, races, body, BASE_URL)
    return ttl is None or now.timestamp() - stored_at < ttl


def _get(url: str) -> dict:
    """Fetch URL, returning the cached response if still fresh."""
    with _db() as con:
        row = con.execute("SELECT body, stored_at FROM api_cache WHERE url = ?", (url,)).fetchone()
        if row:
            body = json.loads(row[0])
            if is_fresh(con, url, body, row[1]):
                return body

    try:
        resp = requests.get(url, timeout=TIMEOUT)
    except requests.RequestException as e:
        logger.warning("Jolpica request failed: %s (%s)", url, e)
        raise UpstreamError() from e

    if resp.status_code == 429:
        logger.warning("Jolpica rate limit hit: %s", url)
        raise RateLimited()
    if resp.status_code == 404:
        # Jolpica 404s for seasons/rounds/ids it doesn't know
        raise NotFound("No F1 data exists for that season, round or name.")
    if resp.status_code >= 400:
        logger.warning("Jolpica returned %s for %s", resp.status_code, url)
        raise UpstreamError()

    try:
        data = resp.json()
    except ValueError as e:
        logger.warning("Jolpica sent non-JSON for %s", url)
        raise UpstreamError() from e
    if "MRData" not in data:
        logger.warning("Jolpica response without MRData for %s", url)
        raise UpstreamError()

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


def get_drivers(season: str) -> dict:
    data = _get(f"{BASE_URL}/{season}/drivers.json?limit=100")
    raw = data["MRData"]["DriverTable"]["Drivers"]

    drivers = []
    for d in raw:
        nationality = d.get("nationality", "")
        drivers.append(
            {
                "driverId": d["driverId"],
                "code": d.get("code", ""),
                "number": d.get("permanentNumber", ""),
                "firstName": d["givenName"],
                "lastName": d["familyName"],
                "fullName": f"{d['givenName']} {d['familyName']}",
                "dateOfBirth": d.get("dateOfBirth", ""),
                "nationality": nationality,
                "flag": FLAG_MAP.get(nationality, "🏁"),
                "url": d.get("url", ""),
                "season": season,
            }
        )

    return {"season": season, "drivers": drivers, "total": len(drivers)}


def get_driver_standings(season: str) -> dict:
    data = _get(f"{BASE_URL}/{season}/driverStandings.json?limit=100")
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
        standings.append(
            {
                # Excluded entries (e.g. Tyrrell 1985, McLaren 2007) have no position;
                # 99 = not classified, as in race results
                "position": int(s.get("position", 99)),
                "points": float(s["points"]),
                "wins": int(s["wins"]),
                "driverId": d["driverId"],
                "code": d.get("code", ""),
                "number": d.get("permanentNumber", ""),
                "fullName": f"{d['givenName']} {d['familyName']}",
                "familyName": d["familyName"],
                "nationality": d.get("nationality", ""),
                "flag": FLAG_MAP.get(d.get("nationality", ""), "🏁"),
                "constructorId": constructor_id,
                "constructorName": team.get("name", ""),
                "teamColor": _team_color(constructor_id),
            }
        )

    return {
        "season": season,
        "round": standings_list[0].get("round", 0),
        "standings": standings,
    }


# ── Constructors ──────────────────────────────────────────────────────────────


def get_constructors(season: str) -> dict:
    data = _get(f"{BASE_URL}/{season}/constructors.json?limit=50")
    raw = data["MRData"]["ConstructorTable"]["Constructors"]

    constructors = []
    for c in raw:
        cid = c["constructorId"]
        nat = c.get("nationality", "")
        constructors.append(
            {
                "constructorId": cid,
                "name": c["name"],
                "nationality": nat,
                "flag": FLAG_MAP.get(nat, "🏁"),
                "url": c.get("url", ""),
                "color": _team_color(cid),
                "season": season,
            }
        )

    return {"season": season, "constructors": constructors, "total": len(constructors)}


def get_constructor_standings(season: str) -> dict:
    data = _get(f"{BASE_URL}/{season}/constructorStandings.json?limit=100")
    standings_list = data["MRData"]["StandingsTable"]["StandingsLists"]

    if not standings_list:
        return {"season": season, "round": 0, "standings": []}

    raw = standings_list[0]["ConstructorStandings"]
    standings = []
    for s in raw:
        c = s["Constructor"]
        cid = c["constructorId"]
        nat = c.get("nationality", "")
        standings.append(
            {
                # Excluded entries (e.g. Tyrrell 1985, McLaren 2007) have no position;
                # 99 = not classified, as in race results
                "position": int(s.get("position", 99)),
                "points": float(s["points"]),
                "wins": int(s["wins"]),
                "constructorId": cid,
                "name": c["name"],
                "nationality": nat,
                "flag": FLAG_MAP.get(nat, "🏁"),
                "color": _team_color(cid),
            }
        )

    return {
        "season": season,
        "round": standings_list[0].get("round", 0),
        "standings": standings,
    }


# ── Circuits ──────────────────────────────────────────────────────────────────


def get_circuits(season: str) -> dict:
    data = _get(f"{BASE_URL}/{season}/circuits.json?limit=30")
    raw = data["MRData"]["CircuitTable"]["Circuits"]

    circuits = []
    for c in raw:
        loc = c.get("Location", {})
        country = loc.get("country", "")
        circuits.append(
            {
                "circuitId": c["circuitId"],
                "name": c["circuitName"],
                "locality": loc.get("locality", ""),
                "country": country,
                "flag": FLAG_MAP.get(country, "🏁"),
                "lat": float(loc.get("lat", 0)),
                "lng": float(loc.get("long", 0)),
                "url": c.get("url", ""),
                "season": season,
            }
        )

    return {"season": season, "circuits": circuits, "total": len(circuits)}


# ── Seasons ───────────────────────────────────────────────────────────────────


def get_seasons() -> dict:
    data = _get(f"{BASE_URL}/seasons.json?limit=100&offset=65")
    raw = data["MRData"]["SeasonTable"]["Seasons"]
    seasons = [s["season"] for s in reversed(raw)]
    return {"seasons": seasons}


# ── Race Schedule ─────────────────────────────────────────────────────────────


def get_schedule(season: str) -> dict:
    data = _get(f"{BASE_URL}/{season}.json?limit=30")
    raw = data["MRData"]["RaceTable"]["Races"]

    races = []
    for r in raw:
        circuit = r.get("Circuit", {})
        loc = circuit.get("Location", {})
        country = loc.get("country", "")
        races.append(
            {
                "round": int(r["round"]),
                "raceName": r["raceName"],
                "season": r["season"],
                "date": r.get("date", ""),
                "time": r.get("time", ""),
                "circuitId": circuit.get("circuitId", ""),
                "circuitName": circuit.get("circuitName", ""),
                "locality": loc.get("locality", ""),
                "country": country,
                "flag": FLAG_MAP.get(country, "🏁"),
                "lat": float(loc.get("lat", 0)),
                "lng": float(loc.get("long", 0)),
                # nested session times if present
                "fp1": r.get("FirstPractice", {}).get("date", ""),
                "fp2": r.get("SecondPractice", {}).get("date", ""),
                "fp3": r.get("ThirdPractice", {}).get("date", ""),
                "qualifying": r.get("Qualifying", {}).get("date", ""),
                "sprint": r.get("Sprint", {}).get("date", ""),
            }
        )

    return {"season": season, "total": len(races), "races": races}


# ── Next Race ─────────────────────────────────────────────────────────────────

# Jolpica session keys in weekend order, with display names
_SESSION_KEYS = [
    ("FirstPractice", "fp1", "Practice 1"),
    ("SecondPractice", "fp2", "Practice 2"),
    ("ThirdPractice", "fp3", "Practice 3"),
    ("SprintQualifying", "sprint_qualifying", "Sprint Qualifying"),
    ("Sprint", "sprint", "Sprint"),
    ("Qualifying", "qualifying", "Qualifying"),
]


def _utc_iso(date: str, time_: str) -> str:
    """Combine Jolpica's date + time ('20:00:00Z') into an ISO UTC string."""
    if not date:
        return ""
    return f"{date}T{time_ or '00:00:00Z'}"


def get_next_race(season: str) -> dict:
    data = _get(f"{BASE_URL}/{season}/next.json")
    races = data["MRData"]["RaceTable"]["Races"]
    # Past seasons return the *following* season's opener, so check the season
    expected = str(date.today().year) if season == "current" else str(season)
    if not races or races[0]["season"] != expected:
        return {"season": season, "race": None}

    r = races[0]
    circuit = r.get("Circuit", {})
    loc = circuit.get("Location", {})
    sessions = [
        {"key": key, "name": name, "start": _utc_iso(r[field]["date"], r[field].get("time", ""))}
        for field, key, name in _SESSION_KEYS
        if field in r
    ]
    sessions.append(
        {"key": "race", "name": "Race", "start": _utc_iso(r.get("date", ""), r.get("time", ""))}
    )
    sessions.sort(key=lambda s: s["start"])

    return {
        "season": season,
        "race": {
            "round": int(r["round"]),
            "raceName": r["raceName"],
            "circuitId": circuit.get("circuitId", ""),
            "circuitName": circuit.get("circuitName", ""),
            "locality": loc.get("locality", ""),
            "country": loc.get("country", ""),
            "sessions": sessions,
        },
    }


# ── Race Results ──────────────────────────────────────────────────────────────


def get_race_results(season: str, round_num: str = "last") -> dict:
    data = _get(f"{BASE_URL}/{season}/{round_num}/results.json?limit=100")
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
        results.append(
            {
                "position": int(r["position"]) if r["position"].isdigit() else 99,
                "positionText": r.get("positionText", r["position"]),
                "points": float(r.get("points", 0)),
                "grid": int(r.get("grid", 0)),
                "laps": int(r.get("laps", 0)),
                "status": r.get("status", ""),
                "driverId": driver["driverId"],
                "code": driver.get("code", ""),
                "number": driver.get("permanentNumber", ""),
                "fullName": f"{driver['givenName']} {driver['familyName']}",
                "familyName": driver["familyName"],
                "nationality": nat,
                "flag": FLAG_MAP.get(nat, "🏁"),
                "constructorId": cid,
                "constructorName": constructor.get("name", ""),
                "teamColor": _team_color(cid),
                "time": r.get("Time", {}).get("time", ""),
                "fastestLapTime": fastest.get("Time", {}).get("time", ""),
                "fastestLapRank": int(fastest.get("rank", 99)) if fastest else 99,
                "fastestLapSpeed": fastest.get("AverageSpeed", {}).get("speed", ""),
            }
        )

    circuit = race.get("Circuit", {})
    loc = circuit.get("Location", {})
    return {
        "season": race["season"],
        "round": int(race["round"]),
        "raceName": race["raceName"],
        "date": race.get("date", ""),
        "circuitId": circuit.get("circuitId", ""),
        "circuitName": circuit.get("circuitName", ""),
        "country": loc.get("country", ""),
        "flag": FLAG_MAP.get(loc.get("country", ""), "🏁"),
        "results": results,
    }


# ── Qualifying Results ────────────────────────────────────────────────────────


def get_qualifying(season: str, round_num: str = "last") -> dict:
    data = _get(f"{BASE_URL}/{season}/{round_num}/qualifying.json?limit=100")
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
        results.append(
            {
                "position": int(r["position"]),
                "driverId": driver["driverId"],
                "code": driver.get("code", ""),
                "number": driver.get("permanentNumber", ""),
                "fullName": f"{driver['givenName']} {driver['familyName']}",
                "nationality": nat,
                "flag": FLAG_MAP.get(nat, "🏁"),
                "constructorId": cid,
                "constructorName": constructor.get("name", ""),
                "teamColor": _team_color(cid),
                "q1": r.get("Q1", "—"),
                "q2": r.get("Q2", "—"),
                "q3": r.get("Q3", "—"),
            }
        )

    circuit = race.get("Circuit", {})
    loc = circuit.get("Location", {})
    return {
        "season": race["season"],
        "round": int(race["round"]),
        "raceName": race["raceName"],
        "date": race.get("date", ""),
        "circuitName": circuit.get("circuitName", ""),
        "country": loc.get("country", ""),
        "flag": FLAG_MAP.get(loc.get("country", ""), "🏁"),
        "results": results,
    }


# ── Points Progression ────────────────────────────────────────────────────────


def _driver_series_meta(s: dict) -> dict:
    d = s["Driver"]
    teams = s.get("Constructors", [{}])
    cid = teams[0].get("constructorId", "") if teams else ""
    return {
        "driverId": d["driverId"],
        "code": d.get("code", d["driverId"][:3].upper()),
        "fullName": f"{d['givenName']} {d['familyName']}",
        "teamColor": _team_color(cid),
    }


def _constructor_series_meta(s: dict) -> dict:
    c = s["Constructor"]
    return {
        "constructorId": c["constructorId"],
        "name": c["name"],
        "color": _team_color(c["constructorId"]),
    }


def _progression(
    season: str, endpoint: str, list_key: str, id_key: str, meta, top_n: int | None
) -> dict:
    """
    Points after each completed round, one series per entrant (one call per round).
    Every series has one value per round: None before the entrant's first
    appearance, then the last known total carried over rounds they miss.
    """
    today = date.today().isoformat()
    completed = [r for r in get_schedule(season)["races"] if r["date"] <= today]

    rounds_data = []
    for rnd in range(1, len(completed) + 1):
        try:
            data = _get(f"{BASE_URL}/{season}/{rnd}/{endpoint}.json?limit=100")
            slist = data["MRData"]["StandingsTable"]["StandingsLists"]
            if slist:
                rounds_data.append(slist[0])
        except NotFound:
            pass  # a round with no standings yet; rate limits/outages still raise

    series_map: dict[str, dict] = {}
    for i, rnd in enumerate(rounds_data):
        for s in rnd[list_key]:
            entry = meta(s)
            key = entry[id_key]
            if key not in series_map:
                series_map[key] = {**entry, "points": [None] * i}
            series_map[key]["points"].append(float(s["points"]))
        for v in series_map.values():
            if len(v["points"]) == i:  # missing from this round: carry the total
                v["points"].append(v["points"][-1])

    ranked = sorted(series_map.values(), key=lambda v: -v["points"][-1])
    return {
        "season": season,
        "rounds": [f"R{r['round']}" for r in rounds_data],
        "series": ranked[:top_n] if top_n else ranked,
    }


def get_driver_points_progression(season: str) -> dict:
    """Top 10 drivers' cumulative points after each round."""
    return _progression(
        season, "driverStandings", "DriverStandings", "driverId", _driver_series_meta, 10
    )


def get_constructor_points_progression(season: str) -> dict:
    return _progression(
        season,
        "constructorStandings",
        "ConstructorStandings",
        "constructorId",
        _constructor_series_meta,
        None,
    )


# ── Sprint Results ─────────────────────────────────────────────────────────────


def get_sprint_results(season: str, round_num: str = "last") -> dict:
    data = _get(f"{BASE_URL}/{season}/{round_num}/sprint.json?limit=100")
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
        results.append(
            {
                "position": int(pos_str) if pos_str.isdigit() else 99,
                "positionText": r.get("positionText", pos_str),
                "points": float(r.get("points", 0)),
                "grid": int(r.get("grid", 0)),
                "laps": int(r.get("laps", 0)),
                "status": r.get("status", ""),
                "driverId": driver["driverId"],
                "code": driver.get("code", ""),
                "number": driver.get("permanentNumber", ""),
                "fullName": f"{driver['givenName']} {driver['familyName']}",
                "nationality": nat,
                "flag": FLAG_MAP.get(nat, "🏁"),
                "constructorId": cid,
                "constructorName": constructor.get("name", ""),
                "teamColor": _team_color(cid),
                "time": r.get("Time", {}).get("time", ""),
                "fastestLapTime": fastest.get("Time", {}).get("time", "") if fastest else "",
                "fastestLapRank": int(fastest.get("rank", 99)) if fastest else 99,
            }
        )

    circuit = race.get("Circuit", {})
    loc = circuit.get("Location", {})
    return {
        "season": race["season"],
        "round": int(race["round"]),
        "raceName": race["raceName"],
        "date": race.get("date", ""),
        "circuitId": circuit.get("circuitId", ""),
        "circuitName": circuit.get("circuitName", ""),
        "country": loc.get("country", ""),
        "flag": FLAG_MAP.get(loc.get("country", ""), "🏁"),
        "results": results,
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


def get_pit_stops(season: str, round_num: str = "last") -> dict:
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
    except NotFound:
        pass  # results not published yet; pit stops are still useful alone

    pitstops = []
    for ps in race.get("PitStops", []):
        did = ps["driverId"]
        info = driver_info.get(did, {})
        pitstops.append(
            {
                "driverId": did,
                "code": info.get("code", did[:3].upper()),
                "fullName": info.get("fullName", did),
                "teamColor": info.get("teamColor", "#888888"),
                "constructorName": info.get("constructorName", ""),
                "finishPosition": info.get("position", 99),
                "laps": info.get("laps"),  # laps completed; None without race results
                "stop": int(ps["stop"]),
                "lap": int(ps["lap"]),
                "time": ps.get("time", ""),
                "duration": _parse_duration(ps.get("duration", "0")),
            }
        )

    # Fallback total laps from pit stop data if race results unavailable
    if not total_laps and pitstops:
        total_laps = max(ps["lap"] for ps in pitstops)

    circuit = race.get("Circuit", {})
    loc = circuit.get("Location", {})
    return {
        "season": race["season"],
        "round": int(race["round"]),
        "raceName": race["raceName"],
        "date": race.get("date", ""),
        "country": loc.get("country", ""),
        "flag": FLAG_MAP.get(loc.get("country", ""), "🏁"),
        "totalLaps": total_laps,
        "pitstops": pitstops,
    }


# ── Driver Season Results (for H2H) ──────────────────────────────────────────


def get_driver_season_results(season: str, driver_id: str = "") -> dict:
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
                "driverId": d["driverId"],
                "fullName": f"{d['givenName']} {d['familyName']}",
                "code": d.get("code", ""),
                "flag": FLAG_MAP.get(nat, "🏁"),
                "constructorId": cid,
                "constructorName": constructor.get("name", ""),
                "teamColor": _team_color(cid),
            }

        pos_str = str(r["position"])
        pos_int = int(pos_str) if pos_str.isdigit() else 99
        fastest = r.get("FastestLap", {})
        results.append(
            {
                "round": int(race["round"]),
                "raceName": race["raceName"],
                "date": race.get("date", ""),
                "position": pos_int,
                "positionText": r.get("positionText", pos_str),
                "points": float(r.get("points", 0)),
                "grid": int(r.get("grid", 0)),
                "laps": int(r.get("laps", 0)),
                "status": r.get("status", ""),
                "constructorId": cid,
                "constructorName": constructor.get("name", ""),
                "teamColor": _team_color(cid),
                "fastestLapRank": int(fastest.get("rank", 99)) if fastest else 99,
                "time": r.get("Time", {}).get("time", ""),
            }
        )

    return {"season": season, "driver": driver_meta, "results": results}


def get_driver_season_sprint_results(season: str, driver_id: str = "") -> list:
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
            results.append(
                {
                    "round": int(race["round"]),
                    "points": float(r.get("points", 0)),
                    "position": pos_int,
                    "status": r.get("status", ""),
                }
            )
        return results
    except NotFound:
        return []  # no sprint/qualifying entries for this driver


_CONSTRUCTOR_RESULT_KEYS = {
    "results": "Results",
    "sprint": "SprintResults",
    "qualifying": "QualifyingResults",
}


def get_constructor_season(season: str, constructor_id: str, endpoint: str) -> list[dict]:
    """
    One row per car per round for a constructor's season. endpoint is
    "results", "sprint" or "qualifying"; [] if the team has no such entries.
    """
    try:
        data = _get(f"{BASE_URL}/{season}/constructors/{constructor_id}/{endpoint}.json?limit=100")
    except NotFound:
        return []
    rows = []
    for race in data["MRData"]["RaceTable"]["Races"]:
        for r in race.get(_CONSTRUCTOR_RESULT_KEYS[endpoint], []):
            pos_str = str(r["position"])
            fastest = r.get("FastestLap", {})
            rows.append(
                {
                    "round": int(race["round"]),
                    "raceName": race["raceName"],
                    "constructorName": r.get("Constructor", {}).get("name", ""),
                    "driverId": r["Driver"]["driverId"],
                    "code": r["Driver"].get("code", r["Driver"]["driverId"][:3].upper()),
                    "position": int(pos_str) if pos_str.isdigit() else 99,
                    "positionText": r.get("positionText", pos_str),
                    "points": float(r.get("points", 0)),
                    "fastestLapRank": int(fastest.get("rank", 99)) if fastest else 99,
                }
            )
    return rows


def get_driver_season_qualifying(season: str, driver_id: str = "") -> list:
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
            results.append(
                {
                    "round": int(race["round"]),
                    "position": int(pos_str) if pos_str.isdigit() else 99,
                    "q1": r.get("Q1", ""),
                    "q2": r.get("Q2", ""),
                    "q3": r.get("Q3", ""),
                }
            )
        return results
    except NotFound:
        return []  # no sprint/qualifying entries for this driver
