SELECT
    circuit_id,
    ANY_VALUE(circuit_name)                         AS circuit_name,
    ANY_VALUE(country)                              AS country,
    ANY_VALUE(locality)                             AS locality,
    ANY_VALUE(lat)                                  AS lat,
    ANY_VALUE(lng)                                  AS lng,
    COUNT(*)                                        AS total_races_held,
    MIN(season)                                     AS first_race_year,
    MAX(season)                                     AS last_race_year,
    -- most successful driver here
    MODE(winner)                                    AS most_successful_driver,
    -- most successful constructor here
    MODE(winning_constructor)                       AS most_successful_constructor,
    ROUND(AVG(dnf_pct), 1)                          AS avg_dnf_pct,
    ROUND(AVG(avg_position_change), 2)              AS overtaking_index,
    -- fastest lap ever recorded
    MIN(NULLIF(race_fastest_lap,''))                AS all_time_fastest_lap
FROM {{ ref('int_circuit_history') }}
GROUP BY circuit_id
