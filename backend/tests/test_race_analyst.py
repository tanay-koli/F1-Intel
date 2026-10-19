"""race_analyst.py: a snapshot of real output, plus one test per threshold constant."""

import json

import pytest

import race_analyst as ra
import schemas
from conftest import load_fixture

# ── Snapshot ──────────────────────────────────────────────────────────────────


def test_snapshot_matches_recorded_output(race_analysis):
    """Fixed input (2022 Monza analysis) must give the recorded insights.

    If you change the analyst on purpose, re-record with scripts/record_fixtures.py
    and review the diff of tests/fixtures/race_analyst_2022_16.json.
    """
    expected = load_fixture("race_analyst_2022_16.json")
    assert ra.analyze_race(race_analysis) == expected


def test_one_insight_per_lap(race_analysis):
    insights = ra.analyze_race(race_analysis)
    assert [i["lap"] for i in insights] == list(range(1, race_analysis["totalLaps"] + 1))
    for i in insights:
        schemas.LapInsight.model_validate(i)


def test_analysis_fixture_matches_response_model(race_analysis):
    out = schemas.RaceAnalysisResponse.model_validate(race_analysis).model_dump(
        mode="json", exclude_unset=True
    )
    assert json.dumps(out, sort_keys=True) == json.dumps(race_analysis, sort_keys=True)


# ── Thresholds ────────────────────────────────────────────────────────────────
# Small synthetic races: each test places one value just inside and just
# outside a threshold and checks the phrase that threshold controls.


def lap(n, pos, gap, compound="MEDIUM", tyre=5):
    return {
        "lap": n,
        "lapTime": 90.0,
        "lapTimeStr": "1:30.000",
        "position": pos,
        "gapToLeader": gap,
        "compound": compound,
        "tyreLife": tyre,
        "isPitLap": False,
    }


def driver(code, name, laps, pit_laps=(), stints=()):
    return {
        "code": code,
        "fullName": name,
        "team": "T",
        "teamColor": "#FFFFFF",
        "laps": laps,
        "pitLaps": list(pit_laps),
        "stints": list(stints),
    }


def snapshot(drivers, lap_num=2):
    return ra._build_snapshot({"drivers": drivers, "raceEvents": []}, lap_num, None)


def two_car_snapshot(gap, tyre_leader=5, tyre_chaser=5):
    return snapshot(
        [
            driver("AAA", "Ann Alpha", [lap(2, 1, 0.0, tyre=tyre_leader)]),
            driver("BBB", "Bob Beta", [lap(2, 2, gap, tyre=tyre_chaser)]),
        ]
    )


def test_battle_gap():
    below = ra._gen_key_battles(two_car_snapshot(ra.BATTLE_GAP - 0.01), is_lap1=False)
    above = ra._gen_key_battles(two_car_snapshot(ra.BATTLE_GAP + 0.01), is_lap1=False)
    assert "battling" in below
    assert "close to" in above and "battling" not in above


def test_close_gap():
    inside = ra._gen_key_battles(two_car_snapshot(ra.CLOSE_GAP - 0.01), is_lap1=False)
    outside = ra._gen_key_battles(two_car_snapshot(ra.CLOSE_GAP + 0.01), is_lap1=False)
    assert "Beta" in inside and "behind Alpha" in inside
    assert outside.startswith("No gaps under")


@pytest.mark.parametrize(
    ("gap", "word"),
    [(ra.COMFORT_GAP + 0.1, "comfortably"), (ra.COMFORT_GAP, "narrowly")],
)
def test_comfort_gap(gap, word):
    # No previous lap, gainers or fastest-lap match, so the default headline is used
    headline = ra._gen_headline(two_car_snapshot(gap), None, {"time": 0}, is_lap1=False)
    assert f"leads {word}" in headline


@pytest.mark.parametrize(
    ("gap", "expected"),
    [(ra.UNDERCUT_WINDOW - 0.1, True), (ra.UNDERCUT_WINDOW + 0.1, False)],
)
def test_undercut_window(gap, expected):
    # Chaser's tyres are 6 laps older than the car ahead (> 5 needed)
    snap = two_car_snapshot(gap, tyre_leader=4, tyre_chaser=10)
    text = ra._gen_strategy_watch(snap, stint_avgs={}, total_laps=100, is_lap1=False)
    assert ("Undercut window open for Beta" in text) is expected


@pytest.mark.parametrize(("extra", "expected"), [(1, True), (0, False)])
def test_overdue_extra(extra, expected):
    avg = 20.0
    tyre = int(avg + ra.OVERDUE_EXTRA + extra)  # overdue means strictly beyond avg + extra
    snap = snapshot([driver("AAA", "Ann Alpha", [lap(2, 1, 0.0, tyre=tyre)])])
    text = ra._gen_strategy_watch(snap, {"MEDIUM": avg}, total_laps=100, is_lap1=False)
    assert ("overdue" in text) is expected


def test_stint_average_ignores_final_and_short_stints():
    stints = [
        {"compound": "SOFT", "length": 10},
        {"compound": "SOFT", "length": 2},  # too short to count
        {"compound": "HARD", "length": 30},  # final stint: may be cut short
    ]
    assert ra._stint_avg([driver("AAA", "Ann Alpha", [], stints=stints)]) == {"SOFT": 10.0}
