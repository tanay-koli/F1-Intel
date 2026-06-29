SELECT
    driver_id,
    driver_name,
    nationality,
    MIN(season)                                     AS first_season,
    MAX(season)                                     AS last_season,
    COUNT(DISTINCT season)                          AS seasons_active,
    COUNT(*)                                        AS total_races,
    SUM(CASE WHEN is_win    THEN 1 ELSE 0 END)      AS total_wins,
    SUM(CASE WHEN is_podium THEN 1 ELSE 0 END)      AS total_podiums,
    SUM(CASE WHEN is_dnf    THEN 1 ELSE 0 END)      AS total_dnfs,
    SUM(CASE WHEN has_fastest_lap THEN 1 ELSE 0 END) AS total_fastest_laps,
    SUM(points)                                     AS career_points,
    ROUND(AVG(CASE WHEN is_classified THEN position END), 2) AS avg_finish,
    COUNT(DISTINCT constructor_id)                  AS teams_raced_for,
    -- points per race (classified only)
    ROUND(
        SUM(points) / NULLIF(COUNT(*),0), 2
    )                                               AS points_per_race
FROM {{ ref('stg_results') }}
GROUP BY driver_id, driver_name, nationality
