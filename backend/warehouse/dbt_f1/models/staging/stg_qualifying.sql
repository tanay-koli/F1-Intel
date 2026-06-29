SELECT
    season, round, race_name, circuit_id,
    driver_id, driver_code AS code,
    driver_name, constructor_id,
    position                                        AS quali_position,
    q1, q2, q3,
    -- best qualifying time across all sessions
    COALESCE(
        NULLIF(q3,''), NULLIF(q2,''), NULLIF(q1,'')
    )                                               AS best_quali_time
FROM raw_qualifying
