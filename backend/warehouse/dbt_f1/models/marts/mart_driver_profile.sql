-- One row per driver — the master profile query
SELECT
    c.driver_id,
    c.driver_name,
    c.nationality,
    c.first_season,
    c.last_season,
    c.seasons_active,
    c.total_races,
    c.total_wins,
    c.total_podiums,
    c.total_dnfs,
    c.total_fastest_laps,
    c.career_points,
    c.points_per_race,
    c.avg_finish,
    c.teams_raced_for,
    -- best championship position ever
    MIN(ds.position)                                AS best_championship_pos,
    -- championship wins
    SUM(CASE WHEN ds.position = 1 THEN 1 ELSE 0 END) AS championships
FROM {{ ref('int_driver_career') }} c
LEFT JOIN raw_driver_standings ds
    ON c.driver_id = ds.driver_id
    -- only final round of each season
    AND ds.round = (
        SELECT MAX(round) FROM raw_driver_standings s2 WHERE s2.season = ds.season
    )
GROUP BY ALL
