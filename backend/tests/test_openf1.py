"""openf1.py: session matching, the race builder, car traces, errors, and the year dispatch."""

import pytest

import openf1
import schemas
import telemetry
from errors import DataNotAvailable, NotFound, RateLimited


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    openf1.session_key.cache_clear()
    telemetry._analysis_cache.clear()
    monkeypatch.setattr(openf1, "_MIN_INTERVAL", 0)


def lap(number, n, start, duration):
    return {
        "driver_number": number,
        "lap_number": n,
        "date_start": f"2024-09-01T13:{start}+00:00",
        "lap_duration": duration,
    }


# Two drivers; 16 leads lap 1, 4 passes on lap 2 and wins; 22 retires on lap 1
RAW = {
    "drivers": [
        {
            "driver_number": n,
            "name_acronym": code,
            "first_name": f,
            "last_name": last,
            "team_name": "T",
            "team_colour": "FF8000",
        }
        for n, code, f, last in [
            (16, "LEC", "Charles", "Leclerc"),
            (4, "NOR", "Lando", "Norris"),
            (22, "TSU", "Yuki", "Tsunoda"),
        ]
    ],
    "laps": [
        lap(16, 1, "00:00", 90.0),
        lap(16, 2, "01:30", 85.0),  # crosses at 02:55
        lap(4, 1, "00:00", 90.5),
        lap(4, 2, "01:30.5", 84.0),  # crosses at 02:54.5
        lap(22, 1, "00:00", None),  # never completes a lap
    ],
    "intervals": [
        {"driver_number": 4, "date": "2024-09-01T13:01:30.5+00:00", "gap_to_leader": 0.5},
        {"driver_number": 4, "date": "2024-09-01T13:02:54.5+00:00", "gap_to_leader": 0.0},
        {"driver_number": 16, "date": "2024-09-01T13:02:55+00:00", "gap_to_leader": "+1 LAP"},
    ],
    "stints": [
        {
            "driver_number": 16,
            "lap_start": 1,
            "lap_end": 1,
            "compound": "MEDIUM",
            "tyre_age_at_start": 0,
        },
        {
            "driver_number": 16,
            "lap_start": 2,
            "lap_end": 2,
            "compound": "HARD",
            "tyre_age_at_start": 3,
        },
    ],
    "pit": [{"driver_number": 16, "lap_number": 1}],
    "race_control": [{"lap_number": 1, "message": "SAFETY CAR DEPLOYED", "flag": None}],
    "session_result": [
        {"driver_number": 4, "position": 1},
        {"driver_number": 16, "position": 2},
        {"driver_number": 22, "position": None, "dnf": True},
    ],
    "meetings": [{"meeting_name": "Italian Grand Prix"}],
}


def test_build_race():
    race = openf1.build_race(RAW, grid={"LEC": 4, "NOR": 1})
    assert race["raceName"] == "Italian Grand Prix"
    assert race["control"] == [(1, "SAFETY CAR DEPLOYED", "")]

    nor, lec = race["drivers"][0], race["drivers"][1]
    assert (nor["code"], nor["grid"], nor["finish"]) == ("NOR", 1, 1)
    assert (lec["fullName"], lec["teamColor"], lec["pitLaps"]) == (
        "Charles Leclerc",
        "#FF8000",
        [1],
    )

    # Positions follow the order of crossing the line on each lap
    assert [r["position"] for r in lec["laps"]] == [1, 2]
    assert [r["position"] for r in nor["laps"]] == [2, 1]
    # Gap at each lap end; a "+1 LAP" string is no number
    assert [r["gapToLeader"] for r in nor["laps"]] == [0.5, 0.0]
    assert lec["laps"][1]["gapToLeader"] is None
    # Fresh tyres read 1 on their first lap; a used set adds its age
    assert [(r["compound"], r["tyreLife"]) for r in lec["laps"]] == [("MEDIUM", 1), ("HARD", 4)]
    assert [r["isPitLap"] for r in lec["laps"]] == [True, False]
    assert nor["laps"][0]["compound"] == "UNKNOWN"  # no stint data

    # A retirement has no classified position and no completed lap
    tsu = race["drivers"][2]
    assert tsu["finish"] is None and tsu["laps"][0]["position"] is None


def test_untimed_final_lap_ranks_by_classification():
    # OpenF1 often has no time at all for a finisher's last lap
    raw = {
        **RAW,
        "laps": [{**x, "lap_duration": None} if x["lap_number"] == 2 else x for x in RAW["laps"]],
    }
    nor, lec, tsu = openf1.build_race(raw, grid={})["drivers"]
    assert [r["position"] for r in nor["laps"]] == [2, 1]
    assert [r["position"] for r in lec["laps"]] == [1, 2]
    assert nor["laps"][1]["gapToLeader"] == 0.0  # the last gap recorded
    assert tsu["laps"][0]["position"] is None  # not classified: no position made up


def test_race_analysis_dispatches_to_openf1_and_matches_the_schema(mocker):
    mocker.patch("openf1.race", return_value=openf1.build_race(RAW, grid={"NOR": 1}))
    load = mocker.patch("telemetry._load_session")

    analysis = telemetry.get_full_race_analysis(2024, 16)

    load.assert_not_called()
    schemas.RaceAnalysisResponse.model_validate(analysis)
    assert [d["code"] for d in analysis["drivers"]] == ["NOR", "LEC", "TSU"]
    assert analysis["raceEvents"] == [{"type": "SC", "lap": 1, "message": "SAFETY CAR DEPLOYED"}]
    assert analysis["overallFastestLap"]["driver"] == "NOR"
    assert analysis["drivers"][1]["stints"] == [
        {"compound": "MEDIUM", "startLap": 1, "endLap": 1, "length": 1},
        {"compound": "HARD", "startLap": 2, "endLap": 2, "length": 1},
    ]


def test_speed_trace_dispatches_to_openf1(mocker):
    samples = [
        {
            "date": f"2024-08-31T15:00:0{s}+00:00",
            "speed": 36,
            "throttle": 100,
            "brake": b,
            "n_gear": 3,
        }
        for s, b in [(0, 0), (1, 100), (2, 0)]
    ]
    ident = {"code": "LEC", "fullName": "Charles Leclerc", "team": "T", "teamColor": "#FF0000"}
    mocker.patch("openf1.fastest_lap", return_value=(ident, 79.461, openf1.car_trace(samples)))
    mocker.patch("openf1.scheduled_race", return_value={"raceName": "Italian Grand Prix"})

    trace = telemetry.get_speed_trace(2024, 16, "Q", "16", "4", n_points=3)

    schemas.SpeedTraceResponse.model_validate(trace)
    assert trace["distance"] == [0.0, 10.0, 20.0]  # 36 km/h = 10 m/s, integrated
    assert trace["driver1"]["brake"] == [0.0, 1.0, 0.0]  # 0/100 -> FastF1's 0/1
    assert trace["driver1"]["lapTime"] == "1:19.461"


SCHEDULE = {
    "races": [{"round": 22, "raceName": "Las Vegas GP", "date": "2024-11-23", "time": "22:00:00Z"}]
}
RACES = [
    {"session_key": 1, "meeting_key": 10, "date_start": "2024-11-03T15:00:00+00:00"},
    {"session_key": 2, "meeting_key": 20, "date_start": "2024-11-24T06:00:00+00:00"},
]


def fake_get(path, params, filters=""):
    if params.get("session_name") == "Race":
        return RACES
    if params == {"meeting_key": 20, "session_name": "Qualifying"}:
        return [{"session_key": 3}]
    return []


def test_session_key_matches_on_race_start(mocker):
    # Jolpica's date is a day off the real UTC start: still the closest race
    mocker.patch("ergast.get_schedule", return_value=SCHEDULE)
    mocker.patch("openf1._get", side_effect=fake_get)
    assert openf1.session_key(2024, 22, "R") == 2
    assert openf1.session_key(2024, 22, "Q") == 3
    with pytest.raises(NotFound, match="doesn't exist"):
        openf1.session_key(2024, 22, "S")
    with pytest.raises(NotFound, match="no round 5"):
        openf1.session_key(2024, 5, "R")


def test_session_key_without_a_race_within_a_day(mocker):
    mocker.patch("ergast.get_schedule", return_value=SCHEDULE)
    mocker.patch("openf1._get", return_value=RACES[:1])
    with pytest.raises(DataNotAvailable):
        openf1.session_key(2024, 22, "R")


def test_get_429_is_rate_limited(mocker):
    mocker.patch("requests.get", return_value=mocker.Mock(status_code=429))
    with pytest.raises(RateLimited):
        openf1._get("laps", {"session_key": 1})


def test_get_404_is_no_rows(mocker):
    # OpenF1 answers an empty result with 404 "No results found."
    mocker.patch("requests.get", return_value=mocker.Mock(status_code=404))
    assert openf1._get("laps", {"session_key": 1}) == []


def test_race_without_a_result_is_not_built(mocker):
    # Laps published but no classification yet: refuse, so nothing half-done is stored
    mocker.patch("openf1.session_key", return_value=1)
    mocker.patch(
        "openf1._get", side_effect=lambda path, params: RAW["laps"] if path == "laps" else []
    )
    build = mocker.patch("openf1.build_race")
    with pytest.raises(DataNotAvailable, match="result"):
        openf1.race(2026, 21)
    build.assert_not_called()
