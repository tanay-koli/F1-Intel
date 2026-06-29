import duckdb
from pathlib import Path

DB = str(Path(__file__).parent.parent / "warehouse" / "db" / "f1.duckdb")

def get_driver_profile(driver_id: str) -> dict:
    con = duckdb.connect(DB, read_only=True)

    profile = con.execute("""
        SELECT * FROM mart_driver_profile WHERE driver_id = ?
    """, [driver_id]).fetchdf().to_dict(orient="records")

    season_arc = con.execute("""
        SELECT season, wins, podiums, season_points,
               avg_finish_pos, avg_grid_pos,
               avg_positions_gained, constructor_name
        FROM int_driver_season
        WHERE driver_id = ?
        ORDER BY season
    """, [driver_id]).fetchdf().to_dict(orient="records")

    race_results = con.execute("""
        SELECT season, round, race_name, circuit_id,
               position, grid, points, status,
               constructor_name, fastest_lap_time
        FROM stg_results
        WHERE driver_id = ?
        ORDER BY season, round
    """, [driver_id]).fetchdf().to_dict(orient="records")

    circuit_wins = con.execute("""
        SELECT circuit_id, race_name, COUNT(*) as wins
        FROM stg_results
        WHERE driver_id = ? AND is_win
        GROUP BY circuit_id, race_name
        ORDER BY wins DESC
        LIMIT 10
    """, [driver_id]).fetchdf().to_dict(orient="records")

    con.close()
    return {
        "profile":      profile[0] if profile else {},
        "season_arc":   season_arc,
        "race_results": race_results,
        "circuit_wins": circuit_wins,
    }
