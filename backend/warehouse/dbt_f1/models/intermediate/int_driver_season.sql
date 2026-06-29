SELECT
    driver_id,
    driver_name,
    season,
    constructor_id,
    constructor_name,
    COUNT(*)                                        AS races,
    SUM(CASE WHEN is_win    THEN 1 ELSE 0 END)      AS wins,
    SUM(CASE WHEN is_podium THEN 1 ELSE 0 END)      AS podiums,
    SUM(CASE WHEN is_dnf    THEN 1 ELSE 0 END)      AS dnfs,
    SUM(CASE WHEN has_fastest_lap THEN 1 ELSE 0 END) AS fastest_laps,
    SUM(points)                                     AS season_points,
    ROUND(AVG(
        CASE WHEN is_classified THEN position END
    ), 2)                                           AS avg_finish_pos,
    ROUND(AVG(grid), 2)                             AS avg_grid_pos,
    -- race pace vs quali pace gap
    ROUND(AVG(grid) - AVG(
        CASE WHEN is_classified THEN position END
    ), 2)                                           AS avg_positions_gained
FROM {{ ref('stg_results') }}
GROUP BY driver_id, driver_name, season, constructor_id, constructor_name
