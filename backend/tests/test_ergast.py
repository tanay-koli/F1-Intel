"""ergast.py: reshaping of recorded Jolpica responses, and _get's error mapping."""

import json

import pytest
import requests

import ergast
import schemas
from errors import NotFound, RateLimited, UpstreamError
from services.h2h import head_to_head

# ── Reshaping (recorded responses replayed through _get) ──────────────────────


def roundtrip(model, data):
    """The response model must reproduce the builder's JSON exactly."""
    out = model.model_validate(data).model_dump(mode="json", exclude_unset=True)
    assert json.dumps(out, sort_keys=True) == json.dumps(data, sort_keys=True)


def test_driver_standings(jolpica):
    data = ergast.get_driver_standings("2026")
    rows = data["standings"]
    assert data["season"] == "2026"
    assert [r["position"] for r in rows] == sorted(r["position"] for r in rows)
    leader = rows[0]
    assert isinstance(leader["points"], float)
    assert leader["fullName"].endswith(leader["familyName"])
    assert leader["teamColor"] == ergast.TEAM_COLORS[leader["constructorId"]]
    roundtrip(schemas.DriverStandingsResponse, data)


def test_standings_without_position_are_unclassified(jolpica):
    # Jolpica omits `position` for entries excluded from the championship
    drivers = ergast.get_driver_standings("1985")["standings"]
    assert any(d["position"] == 99 for d in drivers)
    constructors = ergast.get_constructor_standings("2007")["standings"]
    mclaren = next(c for c in constructors if c["constructorId"] == "mclaren")
    assert mclaren["position"] == 99
    assert mclaren["points"] == 0


def test_standings_are_not_truncated(jolpica):
    # Jolpica's default page is 30 rows; 1985 has 36 classified-or-excluded drivers
    assert len(ergast.get_driver_standings("1985")["standings"]) == 36


def test_constructor_standings(jolpica):
    data = ergast.get_constructor_standings("2026")
    assert data["standings"][0]["position"] == 1
    roundtrip(schemas.ConstructorStandingsResponse, data)


@pytest.mark.parametrize(("season", "rnd"), [("2026", "last"), ("2024", "1")])
def test_race_results(jolpica, season, rnd):
    data = ergast.get_race_results(season, rnd)
    winner = data["results"][0]
    assert winner["position"] == 1 and winner["points"] >= 25
    assert isinstance(data["round"], int)
    # Retirements keep a numeric finishing order (positionText "R"), so
    # positions run 1..N without gaps
    positions = [r["position"] for r in data["results"]]
    assert positions == list(range(1, len(positions) + 1))
    roundtrip(schemas.RaceResultsResponse, data)


def test_qualifying_and_sprint(jolpica):
    quali = ergast.get_qualifying("2026", "17")
    assert quali["results"][0]["position"] == 1
    roundtrip(schemas.QualifyingResponse, quali)
    roundtrip(schemas.SprintResponse, ergast.get_sprint_results("2026", "17"))


def test_pit_stops_enriched_from_results(jolpica):
    data = ergast.get_pit_stops("2026", "17")
    assert data["totalLaps"] > 0
    stop = data["pitstops"][0]
    # code/name/colour come from the race results, not the pit-stop feed
    assert len(stop["code"]) == 3 and stop["teamColor"].startswith("#")
    assert stop["duration"] > 0
    roundtrip(schemas.PitStopsResponse, data)


def test_schedule(jolpica):
    data = ergast.get_schedule("2026")
    assert data["total"] == len(data["races"]) > 0
    assert [r["round"] for r in data["races"]] == list(range(1, data["total"] + 1))
    roundtrip(schemas.ScheduleResponse, data)


def test_next_race_sessions_in_order(jolpica):
    race = ergast.get_next_race("2026")["race"]
    starts = [s["start"] for s in race["sessions"]]
    assert starts == sorted(starts)
    assert race["sessions"][-1]["key"] == "race"
    assert all(s.endswith("Z") for s in starts)


def test_next_race_past_season_is_none(jolpica):
    # Jolpica answers /2024/next.json with 2025's round 1
    assert ergast.get_next_race("2024") == {"season": "2024", "race": None}


def test_next_race_current_keyword(mocker):
    this_year = str(ergast.date.today().year)
    race = {"season": this_year, "round": "5", "raceName": "X GP", "date": "2099-01-01"}
    body = {"MRData": {"RaceTable": {"Races": [race]}}}
    mocker.patch("ergast._get", return_value=body)
    assert ergast.get_next_race("current")["race"]["round"] == 5


def test_head_to_head(jolpica):
    data = head_to_head("2026", "norris", "piastri")
    d1, d2 = data["driver1"], data["driver2"]
    assert d1["driverId"] == "norris" and d2["driverId"] == "piastri"
    decided = sum(1 for r in data["races"] if r["winner"])
    assert d1["headToHeadWins"] + d2["headToHeadWins"] == decided
    assert d1["totalPoints"] == d1["points"] + d1["sprintPoints"]
    roundtrip(schemas.H2HResponse, data)


# ── _get: caching and error mapping (requests.get mocked) ─────────────────────


class FakeResponse:
    def __init__(self, status=200, body=None, text=None):
        self.status_code = status
        self._body = body
        self._text = text

    def json(self):
        if self._text is not None:
            raise ValueError("not json")
        return self._body


URL = f"{ergast.BASE_URL}/2026/driverStandings.json"


def test_get_caches_successful_responses(mocker):
    body = {"MRData": {"ok": True}}
    get = mocker.patch("ergast.requests.get", return_value=FakeResponse(200, body))
    assert ergast._get(URL) == body
    assert ergast._get(URL) == body
    assert get.call_count == 1  # second call served from SQLite


@pytest.mark.parametrize(
    ("response", "error"),
    [
        (FakeResponse(429), RateLimited),
        (FakeResponse(404), NotFound),
        (FakeResponse(500), UpstreamError),
        (FakeResponse(200, text="<html>"), UpstreamError),
        (FakeResponse(200, {"unexpected": 1}), UpstreamError),
    ],
)
def test_get_maps_failures(mocker, response, error):
    mocker.patch("ergast.requests.get", return_value=response)
    with pytest.raises(error):
        ergast._get(URL)


def test_get_maps_connection_errors(mocker):
    mocker.patch("ergast.requests.get", side_effect=requests.ConnectionError("down"))
    with pytest.raises(UpstreamError):
        ergast._get(URL)


def test_progression_does_not_hide_rate_limits(mocker):
    # A rate-limited round used to be skipped silently, leaving a gap in the chart
    mocker.patch(
        "ergast.get_schedule",
        return_value={"races": [{"round": 1, "date": "2000-01-01"}]},
    )
    mocker.patch("ergast._get", side_effect=RateLimited())
    with pytest.raises(RateLimited):
        ergast.get_driver_points_progression("2026")


def _standings_round(rnd, *entries):
    rows = [
        {"points": str(pts), "Driver": {"driverId": d, "givenName": "A", "familyName": d}}
        for d, pts in entries
    ]
    return {
        "MRData": {
            "StandingsTable": {"StandingsLists": [{"round": str(rnd), "DriverStandings": rows}]}
        }
    }


def test_progression_aligns_late_joiners_and_carries_absences(mocker):
    races = [{"round": r, "date": "2000-01-01"} for r in (1, 2, 3)]
    mocker.patch("ergast.get_schedule", return_value={"races": races})
    rounds = {
        1: _standings_round(1, ("ver", 25)),
        2: _standings_round(2, ("ver", 50), ("law", 10)),  # law joins in round 2
        3: _standings_round(3, ("law", 28)),  # ver missing: total carried over
    }
    mocker.patch("ergast._get", side_effect=lambda url: rounds[int(url.split("/")[-2])])
    data = ergast.get_driver_points_progression("2000")
    series = {s["driverId"]: s["points"] for s in data["series"]}
    assert data["rounds"] == ["R1", "R2", "R3"]
    assert series == {"ver": [25.0, 50.0, 50.0], "law": [None, 10.0, 28.0]}
