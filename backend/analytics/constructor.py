from pathlib import Path

import duckdb

DB = str(Path(__file__).parent.parent / "warehouse" / "db" / "f1.duckdb")


def get_constructor_profile(constructor_id: str) -> dict:
    con = duckdb.connect(DB, read_only=True)

    profile = (
        con.execute(
            """
        SELECT * FROM mart_constructor_profile WHERE constructor_id = ?
    """,
            [constructor_id],
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    history = (
        con.execute(
            """
        SELECT season, SUM(points) as points, SUM(CASE WHEN is_win THEN 1 ELSE 0 END) as wins
        FROM stg_results
        WHERE constructor_id = ?
        GROUP BY season
        ORDER BY season DESC
    """,
            [constructor_id],
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    top_drivers = (
        con.execute(
            """
        SELECT driver_name, COUNT(*) AS races, SUM(CASE WHEN is_win THEN 1 ELSE 0 END) AS wins
        FROM stg_results
        WHERE constructor_id = ?
        GROUP BY driver_name
        ORDER BY wins DESC, races DESC LIMIT 10
    """,
            [constructor_id],
        )
        .fetchdf()
        .to_dict(orient="records")
    )

    con.close()
    return {
        "profile": profile[0] if profile else {},
        "history": history,
        "top_drivers": top_drivers,
    }
