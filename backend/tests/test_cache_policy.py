"""cache_policy.ttl_for and ergast.is_fresh, with a frozen clock and a synthetic calendar."""

import json
import time
from datetime import UTC, datetime, timedelta

import pytest

import cache_policy as cp
import ergast
from services.cache import clear_cache

BASE = ergast.BASE_URL
NEVER = None
HOUR = cp.DEFAULT_TTL
LIVE = cp.LIVE_TTL

# Round 17 finished on 11 Oct, round 18 (sprint-free) runs 23-25 Oct
RACES = [
    {
        "round": "17",
        "date": "2026-10-11",
        "time": "12:00:00Z",
        "FirstPractice": {"date": "2026-10-09", "time": "09:30:00Z"},
        "Qualifying": {"date": "2026-10-10", "time": "13:00:00Z"},
    },
    {
        "round": "18",
        "date": "2026-10-25",
        "time": "20:00:00Z",
        "FirstPractice": {"date": "2026-10-23", "time": "17:30:00Z"},
        "Qualifying": {"date": "2026-10-24", "time": "21:00:00Z"},
    },
]
R17_END = datetime(2026, 10, 11, 12, tzinfo=UTC) + cp.RESULTS_SETTLE

WITH_DATA = {"MRData": {"RaceTable": {"Races": [{"round": "17"}]}}}
EMPTY = {"MRData": {"RaceTable": {"Races": []}}}


def at(text):
    return datetime.fromisoformat(text).replace(tzinfo=UTC)


BETWEEN_WEEKENDS = at("2026-10-19T12:00")
DURING_R18 = at("2026-10-24T10:00")


@pytest.mark.parametrize(
    ("url", "now", "body", "expected"),
    [
        # Past seasons never expire, whatever the data
        ("2024/1/results.json", BETWEEN_WEEKENDS, WITH_DATA, NEVER),
        ("2024/driverStandings.json", BETWEEN_WEEKENDS, WITH_DATA, NEVER),
        ("1985.json?limit=30", BETWEEN_WEEKENDS, WITH_DATA, NEVER),
        # Not season-specific / next season: hourly
        ("seasons.json?limit=100&offset=65", BETWEEN_WEEKENDS, WITH_DATA, HOUR),
        ("2027.json?limit=30", BETWEEN_WEEKENDS, WITH_DATA, HOUR),
        # Finished round with published data: never; still empty: keep retrying hourly
        ("2026/17/results.json?limit=30", BETWEEN_WEEKENDS, WITH_DATA, NEVER),
        ("2026/17/results.json?limit=30", BETWEEN_WEEKENDS, EMPTY, HOUR),
        ("2026/17/driverStandings.json", BETWEEN_WEEKENDS, WITH_DATA, NEVER),
        ("2026/17/pitstops.json?limit=100", BETWEEN_WEEKENDS, WITH_DATA, NEVER),
        # Future round: hourly; during its weekend: 5 minutes
        ("2026/18/results.json?limit=30", BETWEEN_WEEKENDS, EMPTY, HOUR),
        ("2026/18/results.json?limit=30", DURING_R18, EMPTY, LIVE),
        # Season-level data: hourly between weekends, 5 minutes during one
        ("2026/driverStandings.json", BETWEEN_WEEKENDS, WITH_DATA, HOUR),
        ("2026/driverStandings.json", DURING_R18, WITH_DATA, LIVE),
        ("2026.json?limit=30", DURING_R18, WITH_DATA, LIVE),
        ("2026/last/results.json?limit=30", DURING_R18, WITH_DATA, LIVE),
        ("2026/next.json", BETWEEN_WEEKENDS, WITH_DATA, HOUR),
        ("2026/drivers/norris/results.json?limit=30", DURING_R18, WITH_DATA, LIVE),
        ("current/driverStandings.json", DURING_R18, WITH_DATA, LIVE),
        # A finished round stays final even while the next weekend is live
        ("2026/17/results.json?limit=30", DURING_R18, WITH_DATA, NEVER),
    ],
)
def test_ttl_rules(url, now, body, expected):
    assert cp.ttl_for(f"{BASE}/{url}", now, RACES, body, BASE) == expected


def test_results_settle_boundary():
    url = f"{BASE}/2026/17/results.json?limit=30"
    one_sec = timedelta(seconds=1)
    assert cp.ttl_for(url, R17_END - one_sec, RACES, WITH_DATA, BASE) == LIVE
    assert cp.ttl_for(url, R17_END + one_sec, RACES, WITH_DATA, BASE) == NEVER


def test_weekend_opens_at_first_session():
    url = f"{BASE}/2026/driverStandings.json"
    fp1 = at("2026-10-23T17:30")
    assert cp.ttl_for(url, fp1 - timedelta(minutes=1), RACES, WITH_DATA, BASE) == HOUR
    assert cp.ttl_for(url, fp1, RACES, WITH_DATA, BASE) == LIVE


def test_no_schedule_falls_back_to_an_hour():
    url = f"{BASE}/2026/17/results.json?limit=30"
    assert cp.ttl_for(url, BETWEEN_WEEKENDS, None, WITH_DATA, BASE) == HOUR


def test_race_without_session_times():
    # Old-style entry: no session blocks, no race time
    races = [{"round": "1", "date": "2026-03-08"}]
    url = f"{BASE}/2026/1/results.json?limit=30"
    assert cp.ttl_for(url, at("2026-03-07T12:00"), races, EMPTY, BASE) == LIVE
    assert cp.ttl_for(url, at("2026-03-20T12:00"), races, WITH_DATA, BASE) == NEVER


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("2026.json?limit=30", ("2026", None)),
        ("2026/next.json", ("2026", "next")),
        ("2026/last/results.json?limit=30", ("2026", "last")),
        ("2026/17/results.json?limit=30", ("2026", "17")),
        ("2026/17/laps/1.json", ("2026", "17")),
        ("2026/drivers/norris/results.json", ("2026", None)),
        ("current/constructorStandings.json", ("current", None)),
        ("seasons.json?limit=100", (None, None)),
    ],
)
def test_parse(path, expected):
    assert cp.parse(f"{BASE}/{path}", BASE) == expected


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        (WITH_DATA, True),
        (EMPTY, False),
        ({"MRData": {"StandingsTable": {"season": "2026", "StandingsLists": []}}}, False),
        ({"MRData": {"total": "0"}}, True),  # nothing table-shaped to judge
        (None, False),
    ],
)
def test_has_data(body, expected):
    assert cp.has_data(body) is expected


# ── is_fresh against the SQLite cache ─────────────────────────────────────────


def store(url, body, stored_at):
    with ergast._db() as con:
        con.execute(
            "INSERT OR REPLACE INTO api_cache VALUES (?, ?, ?)", (url, json.dumps(body), stored_at)
        )
        con.commit()


def test_is_fresh_uses_cached_schedule():
    year_ago = time.time() - 365 * 86400
    # A past season entry from a year ago is still fresh
    with ergast._db() as con:
        assert ergast.is_fresh(con, f"{BASE}/2020/1/results.json", WITH_DATA, year_ago)

    # Current-season round: unknown until the schedule is cached (1 h rule)...
    this_year = datetime.now(UTC).year
    url = f"{BASE}/{this_year}/1/results.json?limit=30"
    with ergast._db() as con:
        assert not ergast.is_fresh(con, url, WITH_DATA, year_ago)

    # ...then final once the schedule shows round 1 finished long ago
    schedule = {"MRData": {"RaceTable": {"Races": [{"round": "1", "date": f"{this_year}-01-01"}]}}}
    store(f"{BASE}/{this_year}.json?limit=30", schedule, time.time())
    with ergast._db() as con:
        assert ergast.is_fresh(con, url, WITH_DATA, year_ago)


def test_clear_expired_keeps_final_entries():
    old = time.time() - 30 * 86400
    store(f"{BASE}/2020/1/results.json", WITH_DATA, old)  # past season: kept
    store(f"{BASE}/seasons.json?limit=100&offset=65", WITH_DATA, old)  # hourly: expired
    assert clear_cache(expired_only=True) == {"deleted": 1, "mode": "expired_only"}
    with ergast._db() as con:
        urls = [u for (u,) in con.execute("SELECT url FROM api_cache")]
    assert urls == [f"{BASE}/2020/1/results.json"]
