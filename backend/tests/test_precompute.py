"""Phase 8: precomputed store, read-first/fallback, the job, CLI and scheduler planning."""

import json
from datetime import UTC, datetime, timedelta

import duckdb
import pytest
import requests
from fastapi.testclient import TestClient

import main
import precomputed
from conftest import load_fixture
from errors import DataNotAvailable
from jobs import precompute as job
from jobs import scheduler
from services import race


@pytest.fixture
def analyst_payload(race_analysis):
    return race.build_race_analyst(2022, 16, race_analysis)


# ── Store ─────────────────────────────────────────────────────────────────────


def test_store_round_trip_is_exact(tmp_store, race_analysis):
    tmp_store.write(2022, 16, "race_analysis", race_analysis)
    back = tmp_store.read(2022, 16, "race_analysis")
    assert json.dumps(back) == json.dumps(race_analysis)  # same keys, order and types


def test_store_overwrites_and_misses(tmp_store):
    tmp_store.write(2022, 16, "race_analyst", {"v": 1})
    tmp_store.write(2022, 16, "race_analyst", {"v": 2})
    assert tmp_store.read(2022, 16, "race_analyst") == {"v": 2}
    assert tmp_store.read(2022, 17, "race_analyst") is None


def test_unreadable_store_means_fallback(mocker):
    mocker.patch.object(precomputed.store, "read", side_effect=duckdb.IOException("locked"))
    assert precomputed.read_or_none(2022, 16, "race_analysis") is None


# ── Read first, fall back to live ─────────────────────────────────────────────


def test_analysis_served_from_store(tmp_store, mocker, race_analysis):
    tmp_store.write(2022, 16, "race_analysis", race_analysis)
    live = mocker.patch("services.race.get_full_race_analysis")
    assert race.race_analysis(2022, 16) == race_analysis
    live.assert_not_called()


def test_analysis_falls_back_to_live(mocker, race_analysis):
    live = mocker.patch("services.race.get_full_race_analysis", return_value=race_analysis)
    assert race.race_analysis(2022, 16) == race_analysis
    live.assert_called_once_with(2022, 16)


def test_analysis_falls_back_when_store_unavailable(mocker, race_analysis):
    mocker.patch.object(precomputed.store, "read", side_effect=duckdb.IOException("locked"))
    mocker.patch("services.race.get_full_race_analysis", return_value=race_analysis)
    assert race.race_analysis(2022, 16) == race_analysis


def test_analyst_served_from_store(tmp_store, mocker, analyst_payload):
    tmp_store.write(2022, 16, "race_analyst", analyst_payload)
    live = mocker.patch("services.race.get_full_race_analysis")
    assert race.race_analyst(2022, 16) == analyst_payload
    live.assert_not_called()


def test_analyst_built_from_stored_analysis(tmp_store, mocker, race_analysis, analyst_payload):
    tmp_store.write(2022, 16, "race_analysis", race_analysis)
    live = mocker.patch("services.race.get_full_race_analysis")
    assert race.race_analyst(2022, 16) == analyst_payload
    live.assert_not_called()


def test_routes_return_identical_json_either_way(tmp_store, mocker, race_analysis):
    client = TestClient(main.app)
    mocker.patch("services.race.get_full_race_analysis", return_value=race_analysis)
    live = {
        p: client.get(p).json()
        for p in (
            "/api/telemetry/race-analysis?year=2022&round=16",
            "/api/race-analyst?year=2022&round=16",
        )
    }
    job.precompute_race(2022, 16, tmp_store)
    for path, body in live.items():
        assert client.get(path).json() == body
    assert live["/api/race-analyst?year=2022&round=16"]["insights"] == load_fixture(
        "race_analyst_2022_16.json"
    )


# ── Job ───────────────────────────────────────────────────────────────────────


def test_precompute_race_stores_both(tmp_store, mocker, race_analysis):
    mocker.patch("jobs.precompute.get_full_race_analysis", return_value=race_analysis)
    result = job.precompute_race(2022, 16, tmp_store)
    assert result == {"season": 2022, "round": 16, "stored": ["race_analysis", "race_analyst"]}
    assert tmp_store.read(2022, 16, "race_analysis") == race_analysis
    assert tmp_store.read(2022, 16, "race_analyst")["totalLaps"] == race_analysis["totalLaps"]


def test_precompute_without_data_stores_nothing(tmp_store, mocker):
    mocker.patch("jobs.precompute.get_full_race_analysis", side_effect=DataNotAvailable())
    with pytest.raises(DataNotAvailable):
        job.precompute_race(2025, 16, tmp_store)
    assert tmp_store.read(2025, 16, "race_analysis") is None


# ── CLI ───────────────────────────────────────────────────────────────────────


@pytest.fixture
def cli(mocker, tmp_store, race_analysis):
    """CLI with compute mocked and its own Store pointed at the test database."""
    mocker.patch("jobs.precompute.get_full_race_analysis", return_value=race_analysis)
    mocker.patch("jobs.precompute.Store", side_effect=lambda: precomputed.Store(tmp_store.path))
    tmp_store.close()  # as if the API isn't running
    return mocker


def test_cli_writes_directly(cli, tmp_store, capsys):
    assert job.main(["--season", "2022", "--round", "16"]) == 0
    assert "written directly" in capsys.readouterr().out
    assert tmp_store.read(2022, 16, "race_analysis") is not None


def test_cli_delegates_when_store_locked(cli, capsys):
    cli.patch("precomputed.Store.write", side_effect=duckdb.IOException("locked"))
    post = cli.patch("jobs.precompute.requests.post")
    post.return_value.status_code = 200
    post.return_value.json.return_value = {"season": 2022, "round": 16, "stored": ["x"]}
    assert job.main(["--season", "2022", "--round", "16", "--api", "http://api"]) == 0
    post.assert_called_once()
    assert post.call_args.args[0] == "http://api/api/admin/precompute"
    assert post.call_args.kwargs["params"] == {"year": 2022, "round": 16}
    assert "written by the running API" in capsys.readouterr().out


def test_cli_fails_cleanly_when_locked_and_api_down(cli, capsys):
    cli.patch("precomputed.Store.write", side_effect=duckdb.IOException("locked"))
    cli.patch("jobs.precompute.requests.post", side_effect=requests.ConnectionError("down"))
    assert job.main(["--season", "2022", "--round", "16"]) == 1
    assert "locked" in capsys.readouterr().err


def test_cli_reports_missing_data(mocker, capsys):
    mocker.patch(
        "jobs.precompute.get_full_race_analysis",
        side_effect=DataNotAvailable("No timing data for 2025 round 16."),
    )
    assert job.main(["--season", "2025", "--round", "16"]) == 1
    assert "No timing data" in capsys.readouterr().err


# ── Admin route ───────────────────────────────────────────────────────────────


def test_admin_precompute_from_localhost(mocker, tmp_store, race_analysis):
    mocker.patch("jobs.precompute.get_full_race_analysis", return_value=race_analysis)
    client = TestClient(main.app, client=("127.0.0.1", 50000))
    r = client.post("/api/admin/precompute?year=2022&round=16")
    assert r.status_code == 200
    assert tmp_store.read(2022, 16, "race_analyst") is not None


def test_admin_precompute_rejects_remote_clients():
    client = TestClient(main.app, client=("203.0.113.9", 50000))
    r = client.post("/api/admin/precompute?year=2022&round=16")
    assert r.status_code == 403
    assert r.json()["error"] == "forbidden"


# ── Scheduler planning ────────────────────────────────────────────────────────

RACES = [
    {"season": "2026", "round": 16, "date": "2026-09-27", "time": "12:00:00Z"},
    {"season": "2026", "round": 17, "date": "2026-10-11", "time": "12:00:00Z"},
    {"season": "2026", "round": 18, "date": "2026-10-25", "time": "20:00:00Z"},
]
DELAY = timedelta(hours=5)


def plan_at(now, stored=()):
    return list(scheduler.planned_runs(RACES, now, DELAY, lambda s, r: (s, r) in stored))


def test_plans_future_races_at_start_plus_delay():
    now = datetime(2026, 10, 19, tzinfo=UTC)
    assert plan_at(now) == [(2026, 18, datetime(2026, 10, 26, 1, tzinfo=UTC))]


def test_catches_up_a_recently_missed_run():
    now = datetime(2026, 10, 11, 20, tzinfo=UTC)  # R17's run was due at 17:00
    assert (2026, 17, now) in plan_at(now)
    assert all(rnd != 17 for _, rnd, _ in plan_at(now, stored={(2026, 17)}))


def test_no_backfill_of_older_races():
    now = datetime(2026, 10, 19, tzinfo=UTC)
    assert all(rnd == 18 for _, rnd, _ in plan_at(now))


def test_run_job_logs_and_swallows_missing_data(mocker, caplog):
    mocker.patch("jobs.scheduler.precompute_race", side_effect=DataNotAvailable("nope"))
    scheduler.run_job(2026, 18)  # must not raise inside the scheduler thread
    assert "skipped" in caplog.text
