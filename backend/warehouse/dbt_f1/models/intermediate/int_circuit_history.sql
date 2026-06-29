SELECT
    r.circuit_id,
    s.circuit_name,
    s.country,
    s.locality,
    s.lat,
    s.lng,
    r.season,
    r.round,
    r.race_name,
    -- race winner
    MAX(CASE WHEN r.position = 1 THEN r.driver_name END)      AS winner,
    MAX(CASE WHEN r.position = 1 THEN r.driver_id END)        AS winner_id,
    MAX(CASE WHEN r.position = 1 THEN r.constructor_name END) AS winning_constructor,
    MAX(CASE WHEN r.position = 1 THEN r.constructor_id END)   AS winning_constructor_id,
    MAX(CASE WHEN r.position = 1 THEN r.fastest_lap_time END) AS race_fastest_lap,
    -- race characteristics
    COUNT(*)                                                    AS classified_finishers,
    SUM(CASE WHEN r.is_dnf THEN 1 ELSE 0 END)                 AS dnf_count,
    ROUND(
        SUM(CASE WHEN r.is_dnf THEN 1 ELSE 0 END) * 100.0
        / NULLIF(COUNT(*), 0), 1
    )                                                          AS dnf_pct,
    -- overtaking index: avg positions changed
    ROUND(AVG(ABS(r.grid - r.position)), 2)                   AS avg_position_change
FROM {{ ref('stg_results') }} r
LEFT JOIN raw_schedule s
    ON r.season = s.season AND r.round = s.round
WHERE r.is_classified
GROUP BY r.circuit_id, s.circuit_name, s.country, s.locality,
         s.lat, s.lng, r.season, r.round, r.race_name
