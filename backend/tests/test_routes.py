"""Routes through FastAPI's TestClient, with the data layer mocked or replayed."""

import pytest
from fastapi.testclient import TestClient

import main
from conftest import load_fixture
from errors import DataNotAvailable, NotFound, RateLimited, UpstreamError


@pytest.fixture
def client():
    # raise_server_exceptions=False so unhandled errors become the 500 response
    return TestClient(main.app, raise_server_exceptions=False)


# ── Happy paths (one per route group) ─────────────────────────────────────────


@pytest.mark.parametrize(
    "path",
    [
        "/api/driver-standings?season=2026",
        "/api/constructor-standings?season=2026",
        "/api/results?season=2026&round=last",
        "/api/results?season=2024&round=1",
        "/api/qualifying?season=2026&round=17",
        "/api/sprint?season=2026&round=17",
        "/api/pitstops?season=2026&round=17",
        "/api/schedule?season=2026",
        "/api/next-race?season=2026",
        "/api/h2h?season=2026&driver1=norris&driver2=piastri",
    ],
)
def test_jolpica_routes(client, jolpica, path):
    r = client.get(path)
    assert r.status_code == 200, r.text
    assert r.json()


def test_driver_profile(client, jolpica, mocker):
    mocker.patch(
        "services.profiles.get_drivers",
        return_value={"drivers": [{**_DRIVER, "driverId": "norris"}]},
    )
    r = client.get("/api/drivers/norris?season=2026")
    assert r.status_code == 200
    assert r.json()["driver"]["driverId"] == "norris"
    assert r.json()["standing"]["familyName"] == "Norris"


def test_race_analysis_and_analyst(client, mocker, race_analysis):
    mocker.patch("main.get_full_race_analysis", return_value=race_analysis)
    mocker.patch("services.race.get_full_race_analysis", return_value=race_analysis)

    r = client.get("/api/telemetry/race-analysis?year=2022&round=16")
    assert r.status_code == 200
    assert r.json() == race_analysis  # response model doesn't alter the JSON

    r = client.get("/api/race-analyst?year=2022&round=16")
    assert r.status_code == 200
    assert r.json()["insights"] == load_fixture("race_analyst_2022_16.json")


def test_cache_routes(client):
    assert client.get("/api/cache/stats").json()["total_entries"] == 0
    r = client.delete("/api/cache/clear?expired_only=true")
    assert r.json() == {"deleted": 0, "mode": "expired_only"}


# ── Invalid input → 422 ───────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("path", "field"),
    [
        ("/api/driver-standings?season=abc", "season"),
        ("/api/driver-standings?season=1949", "season"),
        ("/api/results?season=2026&round=0", "round"),
        ("/api/results?season=2026&round=first", "round"),
        ("/api/telemetry/race-analysis?year=2010&round=1", "year"),
        ("/api/telemetry/race-analysis?year=2022&round=99", "round"),
        ("/api/telemetry/drivers?year=2022&round=1&session=XX", "session"),
        ("/api/h2h?season=2026&driver1=norris", "driver2"),
    ],
)
def test_invalid_input(client, path, field):
    r = client.get(path)
    assert r.status_code == 422
    body = r.json()
    assert body["error"] == "invalid_input"
    assert f"'{field}'" in body["message"]
    assert "Value error" not in body["message"]


def test_valid_keywords_accepted(client, mocker):
    get = mocker.patch(
        "main.get_race_results", return_value={"season": "current", "round": "next", "results": []}
    )
    r = client.get("/api/results?season=current&round=next")
    assert r.status_code == 200
    get.assert_called_once_with("current", "next")
    # keys the builder omits stay omitted
    assert r.json() == {"season": "current", "round": "next", "results": []}


# ── App errors → status + {"error", "message"} ────────────────────────────────


@pytest.mark.parametrize(
    ("exc", "status", "code"),
    [
        (DataNotAvailable("No timing data."), 503, "data_not_available"),
        (RateLimited(), 503, "rate_limited"),
        (UpstreamError(), 502, "upstream_error"),
        (NotFound("No such round."), 404, "not_found"),
    ],
)
def test_app_errors(client, mocker, exc, status, code):
    mocker.patch("main.get_full_race_analysis", side_effect=exc)
    r = client.get("/api/telemetry/race-analysis?year=2025&round=16")
    assert r.status_code == status
    assert r.json() == {"error": code, "message": exc.message}


def test_unknown_error_is_500_without_details(client, mocker):
    mocker.patch("main.get_schedule", side_effect=KeyError("secret internals"))
    r = client.get("/api/schedule?season=2026")
    assert r.status_code == 500
    assert r.json()["error"] == "internal_error"
    assert "secret" not in r.text


def test_unknown_route_uses_error_shape(client):
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404
    assert r.json()["error"] == "not_found"


def test_circuit_outline_rejects_path_traversal(client):
    r = client.get("/api/circuit-outline?circuit_id=../../etc")
    assert r.status_code == 422


_DRIVER = {
    "driverId": "",
    "code": "NOR",
    "number": "4",
    "firstName": "Lando",
    "lastName": "Norris",
    "fullName": "Lando Norris",
    "dateOfBirth": "1999-11-13",
    "nationality": "British",
    "flag": "🇬🇧",
    "url": "",
    "season": "2026",
}
