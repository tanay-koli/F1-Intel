from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from ergast import (
    get_drivers, get_driver_standings, get_constructors,
    get_constructor_standings, get_circuits, get_seasons,
    get_schedule, get_race_results, get_qualifying,
    get_driver_points_progression, get_constructor_points_progression,
    get_sprint_results, get_pit_stops, get_driver_season_results,
    get_driver_season_sprint_results, get_driver_season_qualifying,
    get_next_race,
    _db as _api_db,
)
from telemetry import get_speed_trace, get_session_drivers, get_race_lap_data, get_full_race_analysis
from race_analyst import analyze_race

import json
import re
import time
import uvicorn
from pathlib import Path

app = FastAPI(title="F1 Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "F1 Dashboard API", "version": "1.0.0"}


# ── Drivers ──────────────────────────────────────────────────────────────────

@app.get("/api/drivers")
def drivers(season: str = "2026"):
    try:
        return get_drivers(season)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/driver-standings")
def driver_standings(season: str = "2026"):
    try:
        return get_driver_standings(season)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/drivers/{driver_id}")
def driver_profile(driver_id: str, season: str = "2026"):
    try:
        drivers_data = get_drivers(season)
        standings_data = get_driver_standings(season)

        driver = next(
            (d for d in drivers_data["drivers"] if d["driverId"] == driver_id), None
        )
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")

        standing = next(
            (s for s in standings_data["standings"] if s["driverId"] == driver_id), None
        )

        return {"driver": driver, "standing": standing}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Constructors ──────────────────────────────────────────────────────────────

@app.get("/api/constructors")
def constructors(season: str = "2026"):
    try:
        return get_constructors(season)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/constructor-standings")
def constructor_standings(season: str = "2026"):
    try:
        return get_constructor_standings(season)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/constructors/{constructor_id}")
def constructor_profile(constructor_id: str, season: str = "2026"):
    try:
        constructors_data = get_constructors(season)
        standings_data = get_constructor_standings(season)

        constructor = next(
            (c for c in constructors_data["constructors"] if c["constructorId"] == constructor_id), None
        )
        if not constructor:
            raise HTTPException(status_code=404, detail="Constructor not found")

        standing = next(
            (s for s in standings_data["standings"] if s["constructorId"] == constructor_id), None
        )

        return {"constructor": constructor, "standing": standing}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Circuits / Tracks ─────────────────────────────────────────────────────────

@app.get("/api/circuits")
def circuits(season: str = "2026"):
    try:
        return get_circuits(season)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/circuits/{circuit_id}")
def circuit_detail(circuit_id: str, season: str = "2026"):
    try:
        circuits_data = get_circuits(season)
        circuit = next(
            (c for c in circuits_data["circuits"] if c["circuitId"] == circuit_id), None
        )
        if not circuit:
            raise HTTPException(status_code=404, detail="Circuit not found")
        return circuit
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Seasons ───────────────────────────────────────────────────────────────────

@app.get("/api/seasons")
def seasons():
    try:
        return get_seasons()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# ── Race Schedule ─────────────────────────────────────────────────────────────

@app.get("/api/schedule")
def schedule(season: str = "2026"):
    try:
        return get_schedule(season)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Race Results ──────────────────────────────────────────────────────────────

@app.get("/api/results")
def race_results(season: str = "2026", round: str = "last"):
    try:
        return get_race_results(season, round)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Qualifying ────────────────────────────────────────────────────────────────

@app.get("/api/qualifying")
def qualifying(season: str = "2026", round: str = "last"):
    try:
        return get_qualifying(season, round)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Points Progressions ───────────────────────────────────────────────────────

@app.get("/api/driver-progression")
def driver_progression(season: str = "2026"):
    try:
        return get_driver_points_progression(season)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/constructor-progression")
def constructor_progression(season: str = "2026"):
    try:
        return get_constructor_points_progression(season)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Sprint Results ────────────────────────────────────────────────────────────

@app.get("/api/sprint")
def sprint_results(season: str = "2026", round: str = "last"):
    try:
        return get_sprint_results(season, round)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Pit Stops ─────────────────────────────────────────────────────────────────

@app.get("/api/pitstops")
def pit_stops(season: str = "2026", round: str = "last"):
    try:
        return get_pit_stops(season, round)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Head-to-Head ──────────────────────────────────────────────────────────────

@app.get("/api/h2h")
def head_to_head(
    season: str = "2026",
    driver1: str = Query(..., description="First driver ID"),
    driver2: str = Query(..., description="Second driver ID"),
):
    try:
        r1_data = get_driver_season_results(season, driver1)
        r2_data = get_driver_season_results(season, driver2)

        # Fetch sprint results for both drivers
        s1_list = get_driver_season_sprint_results(season, driver1)
        s2_list = get_driver_season_sprint_results(season, driver2)
        s1_map = {s["round"]: s for s in s1_list}
        s2_map = {s["round"]: s for s in s2_list}

        # Fetch qualifying results for both drivers
        q1_list = get_driver_season_qualifying(season, driver1)
        q2_list = get_driver_season_qualifying(season, driver2)
        q1_map = {q["round"]: q for q in q1_list}
        q2_map = {q["round"]: q for q in q2_list}

        r1_map = {r["round"]: r for r in r1_data["results"]}
        r2_map = {r["round"]: r for r in r2_data["results"]}
        all_rounds = sorted(set(list(r1_map.keys()) + list(r2_map.keys())))

        d1_beats = 0
        d2_beats = 0
        races = []
        for rnd in all_rounds:
            rd1 = r1_map.get(rnd)
            rd2 = r2_map.get(rnd)
            winner = None
            if rd1 and rd2:
                if rd1["position"] < rd2["position"]:
                    winner = driver1
                    d1_beats += 1
                elif rd2["position"] < rd1["position"]:
                    winner = driver2
                    d2_beats += 1
            races.append({
                "round":    rnd,
                "raceName": (rd1 or rd2 or {}).get("raceName", f"Round {rnd}"),
                "d1":       rd1,
                "d2":       rd2,
                "winner":   winner,
                "sprint":   {
                    "d1": s1_map.get(rnd),
                    "d2": s2_map.get(rnd),
                },
                "quali": {
                    "d1": q1_map.get(rnd),
                    "d2": q2_map.get(rnd),
                },
            })

        def _agg(results: list, sprint_map: dict, quali_map: dict, beats: int) -> dict:
            if not results:
                return {"points": 0, "sprintPoints": 0, "totalPoints": 0,
                        "wins": 0, "podiums": 0, "fastestLaps": 0,
                        "dnf": 0, "avgPosition": 0.0, "races": 0,
                        "qualiWins": 0, "avgQualiPosition": 0.0,
                        "headToHeadWins": beats}
            pts          = sum(r["points"] for r in results)
            sprint_pts   = sum(s["points"] for s in sprint_map.values())
            wins         = sum(1 for r in results if r["position"] == 1)
            podiums      = sum(1 for r in results if r["position"] <= 3)
            fl           = sum(1 for r in results if r.get("fastestLapRank") == 1)
            dnf          = sum(1 for r in results if not str(r.get("positionText", "")).isdigit())
            finished     = [r["position"] for r in results if r["position"] < 99]
            avg          = round(sum(finished) / len(finished), 2) if finished else 0.0
            quali_pos    = [q["position"] for q in quali_map.values() if q["position"] < 99]
            avg_quali    = round(sum(quali_pos) / len(quali_pos), 2) if quali_pos else 0.0
            return {
                "points":           pts,
                "sprintPoints":     sprint_pts,
                "totalPoints":      pts + sprint_pts,
                "wins":             wins,
                "podiums":          podiums,
                "fastestLaps":      fl,
                "dnf":              dnf,
                "avgPosition":      avg,
                "races":            len(results),
                "qualiWins":        0,   # filled below after comparing both drivers
                "avgQualiPosition": avg_quali,
                "headToHeadWins":   beats,
            }

        agg1 = _agg(r1_data["results"], s1_map, q1_map, d1_beats)
        agg2 = _agg(r2_data["results"], s2_map, q2_map, d2_beats)

        # Count qualifying head-to-head wins
        common_quali_rounds = set(q1_map.keys()) & set(q2_map.keys())
        q1_wins = sum(
            1 for rnd in common_quali_rounds
            if q1_map[rnd]["position"] < q2_map[rnd]["position"]
        )
        q2_wins = len(common_quali_rounds) - q1_wins
        agg1["qualiWins"] = q1_wins
        agg2["qualiWins"] = q2_wins

        return {
            "season":  season,
            "driver1": {**r1_data.get("driver", {}), **agg1},
            "driver2": {**r2_data.get("driver", {}), **agg2},
            "races":   races,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ── Telemetry (FastF1) ────────────────────────────────────────────────────────

@app.get("/api/telemetry/drivers")
def telemetry_drivers(
    year: int = 2024,
    round: int = Query(1, ge=1),
    session: str = "R",
):
    """
    List drivers that recorded lap data in the specified session.
    Use this to populate driver-picker dropdowns before requesting a trace.
    """
    try:
        return get_session_drivers(year, round, session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/telemetry")
def telemetry(
    year: int = 2024,
    round: int = Query(1, ge=1),
    session: str = "R",
    driver1: str = "VER",
    driver2: str = "NOR",
):
    """
    Returns speed, throttle, brake and gear traces for two drivers
    on their respective fastest laps in the given session.
    Data is aligned on a unified distance axis.
    """
    try:
        return get_speed_trace(year, round, session, driver1, driver2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/telemetry/race")
def telemetry_race(
    year: int = 2024,
    round: int = Query(1, ge=1),
    driver1: str = "VER",
    driver2: str = "NOR",
):
    """
    Returns full-race lap-by-lap data for two drivers:
    lap times, positions, gap to leader, tyre compounds, pit stops.
    """
    try:
        return get_race_lap_data(year, round, driver1, driver2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/telemetry/race-analysis")
def telemetry_race_analysis(
    year: int = 2024,
    round: int = Query(1, ge=1),
):
    """
    Returns comprehensive race analysis for ALL drivers:
    grid/finish positions, fastest laps, pit stops, tyre strategies,
    lap-by-lap data, safety car events.
    """
    try:
        return get_full_race_analysis(year, round)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/race-analyst")
def race_analyst_endpoint(
    year: int = 2024,
    round: int = Query(1, ge=1),
):
    """
    Returns per-lap analyst insights for the entire race.
    Reuses the cached race analysis data and runs rule-based analysis.
    """
    try:
        analysis = get_full_race_analysis(year, round)
        insights = analyze_race(analysis)
        return {
            "year":      year,
            "round":     round,
            "raceName":  analysis.get("raceName", ""),
            "totalLaps": analysis.get("totalLaps", 0),
            "insights":  insights,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))





# ── Next race ─────────────────────────────────────────────────────────────────

@app.get("/api/next-race")
def next_race(season: str = "2026"):
    try:
        return get_next_race(season)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Circuit outline ───────────────────────────────────────────────────────────

# Written by warehouse/ingest/ingest_fastf1.py, one file per GP
_CIRCUITS_DIR = Path(__file__).parent / "warehouse" / "raw" / "circuits"
_OUTLINE_POINTS = 300


@app.get("/api/circuit-outline")
def circuit_outline(circuit_id: str, alt: str = ""):
    """
    X/Y outline of a circuit, downsampled to ~300 points.
    Files are named after the GP passed to the export script, so `alt`
    (e.g. the locality) is tried as a second filename.
    """
    names = [n.strip().lower().replace(" ", "_") for n in (circuit_id, alt) if n.strip()]
    for name in names:
        if not re.fullmatch(r"[a-z0-9_]+", name):
            raise HTTPException(status_code=400, detail="Invalid circuit id")
        path = _CIRCUITS_DIR / f"{name}.json"
        if path.exists():
            points = json.loads(path.read_text())
            step = max(1, len(points) // _OUTLINE_POINTS)
            return {"circuitId": circuit_id, "points": points[::step]}
    raise HTTPException(status_code=404, detail="No outline for this circuit")


# ── Cache management ──────────────────────────────────────────────────────────

@app.get("/api/cache/stats")
def cache_stats():
    """Return stats about the Jolpica SQLite API cache."""
    with _api_db() as con:
        rows = con.execute("SELECT COUNT(*), MIN(stored_at), MAX(stored_at) FROM api_cache").fetchone()
        count, oldest, newest = rows
    from ergast import _CACHE_DB
    size_bytes = _CACHE_DB.stat().st_size if _CACHE_DB.exists() else 0
    return {
        "total_entries": count,
        "oldest_entry":  oldest,
        "newest_entry":  newest,
        "db_size_bytes": size_bytes,
    }


@app.delete("/api/cache/clear")
def cache_clear(expired_only: bool = False):
    """
    Clear the Jolpica API cache.
    - expired_only=false (default): wipe everything
    - expired_only=true: remove only entries whose TTL has expired
    """
    from ergast import _TTL_LIVE, _TTL_STATIC, _LIVE_KEYWORDS
    with _api_db() as con:
        if expired_only:
            now = time.time()
            rows = con.execute("SELECT url, stored_at FROM api_cache").fetchall()
            deleted = 0
            for url, stored_at in rows:
                ttl = _TTL_LIVE if any(k in url for k in _LIVE_KEYWORDS) else _TTL_STATIC
                if now - stored_at > ttl:
                    con.execute("DELETE FROM api_cache WHERE url = ?", (url,))
                    deleted += 1
            con.commit()
            return {"deleted": deleted, "mode": "expired_only"}
        else:
            cur = con.execute("DELETE FROM api_cache")
            con.commit()
            return {"deleted": cur.rowcount, "mode": "all"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

