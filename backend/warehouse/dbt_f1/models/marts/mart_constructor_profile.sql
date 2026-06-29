SELECT
    constructor_id,
    constructor_name,
    COUNT(DISTINCT season)                          AS seasons_active,
    MIN(season)                                     AS first_season,
    MAX(season)                                     AS last_season,
    COUNT(*)                                        AS total_race_entries,
    SUM(CASE WHEN is_win    THEN 1 ELSE 0 END)      AS total_wins,
    SUM(CASE WHEN is_podium THEN 1 ELSE 0 END)      AS total_podiums,
    SUM(CASE WHEN is_dnf    THEN 1 ELSE 0 END)      AS total_dnfs,
    SUM(points)                                     AS total_points,
    ROUND(AVG(CASE WHEN is_classified THEN position END), 2) AS avg_finish,
    COUNT(DISTINCT driver_id)                       AS total_drivers_used,
    -- dominant circuit (most wins)
    MODE(CASE WHEN is_win THEN circuit_id END)      AS best_circuit
FROM {{ ref('stg_results') }}
GROUP BY constructor_id, constructor_name
