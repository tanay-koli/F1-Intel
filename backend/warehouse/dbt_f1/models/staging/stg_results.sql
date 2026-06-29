SELECT
    season,
    round,
    race_name,
    circuit_id,
    driver_id,
    driver_code                                     AS code,
    driver_name,
    driver_nationality                              AS nationality,
    constructor_id,
    constructor_name,
    position,
    position_text,
    CASE WHEN position <= 20 AND position >= 1
         THEN true ELSE false END                   AS is_classified,
    CASE WHEN position_text = 'R'
         THEN true ELSE false END                   AS is_dnf,
    CASE WHEN position <= 3
         THEN true ELSE false END                   AS is_podium,
    CASE WHEN position = 1
         THEN true ELSE false END                   AS is_win,
    CASE WHEN fastest_lap_rank = 1
         THEN true ELSE false END                   AS has_fastest_lap,
    grid,
    laps,
    status,
    points,
    fastest_lap_time,
    CAST(fastest_lap_speed AS DOUBLE)               AS fastest_lap_speed
FROM raw_results
