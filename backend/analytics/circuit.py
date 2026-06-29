import duckdb
from pathlib import Path

DB = str(Path(__file__).parent.parent / "warehouse" / "db" / "f1.duckdb")

def get_circuit_profile(circuit_id: str) -> dict:
    con = duckdb.connect(DB, read_only=True)

    profile = con.execute("""
        SELECT * FROM mart_circuit_profile WHERE circuit_id = ?
    """, [circuit_id]).fetchdf().to_dict(orient="records")

    history = con.execute("""
        SELECT season, round, race_name, winner,
               winning_constructor, race_fastest_lap,
               dnf_count, dnf_pct, avg_position_change
        FROM int_circuit_history
        WHERE circuit_id = ?
        ORDER BY season DESC
    """, [circuit_id]).fetchdf().to_dict(orient="records")

    top_drivers = con.execute("""
        SELECT driver_name, COUNT(*) AS wins
        FROM stg_results
        WHERE circuit_id = ? AND is_win
        GROUP BY driver_name
        ORDER BY wins DESC LIMIT 10
    """, [circuit_id]).fetchdf().to_dict(orient="records")

    top_constructors = con.execute("""
        SELECT constructor_name, COUNT(*) AS wins
        FROM stg_results
        WHERE circuit_id = ? AND is_win
        GROUP BY constructor_name
        ORDER BY wins DESC LIMIT 10
    """, [circuit_id]).fetchdf().to_dict(orient="records")

    con.close()
    return {
        "profile":          profile[0] if profile else {},
        "history":          history,
        "top_drivers":      top_drivers,
        "top_constructors": top_constructors,
    }
