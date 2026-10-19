"""
Head-to-head comparison of two drivers over a season: race-by-race results,
sprint and qualifying pairs, and season aggregates.
"""

from ergast import (
    get_driver_season_qualifying,
    get_driver_season_results,
    get_driver_season_sprint_results,
)


def head_to_head(season: str, driver1: str, driver2: str) -> dict:
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
