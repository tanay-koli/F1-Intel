"""
How long a cached Jolpica response stays fresh, decided from the data rather
than from keywords in the URL.

    ttl_for(url, now, races, body) -> seconds, or None for "never expires"

- Past seasons: never expire.
- Current season, a specific finished round (race start + RESULTS_SETTLE has
  passed) whose response actually contains data: never expires. If Jolpica
  hasn't published it yet (empty response), it's retried hourly instead of
  caching "nothing" forever.
- Current season, during a race weekend (first session start until race
  start + RESULTS_SETTLE): 5 minutes for that round and for season-level data
  (standings, schedule, last/next).
- Everything else (current standings/schedule between weekends, future
  rounds, next season, the seasons list): 1 hour.

`races` is the season's raw Jolpica schedule (RaceTable.Races); without it
the policy falls back to 1 hour.
"""

import re
from datetime import datetime, timedelta

LIVE_TTL = 5 * 60
DEFAULT_TTL = 60 * 60
# Time after the race start before a round's data counts as final:
# race (~2 h) plus time for Jolpica to publish and for post-race penalties
RESULTS_SETTLE = timedelta(hours=6)

# Session blocks in a Jolpica race object that can open a weekend
_SESSION_FIELDS = ("FirstPractice", "SprintQualifying", "SprintShootout", "Qualifying", "Sprint")

# {season}/... where season is a year or "current"; round is digits, "last" or "next"
_PATH = re.compile(r"^(?P<season>\d{4}|current)(?:/(?P<round>\d+|last|next)(?=/|\.json))?")


def parse(url: str, base_url: str) -> tuple[str | None, str | None]:
    """(season, round) from a Jolpica URL; round is None for season-level data."""
    path = url.removeprefix(base_url).lstrip("/").split("?")[0]
    m = _PATH.match(path)
    if not m:
        return None, None
    return m["season"], m["round"]


def _at(date: str, time: str | None) -> datetime:
    return datetime.fromisoformat(f"{date}T{(time or '12:00:00Z').replace('Z', '+00:00')}")


def race_start(race: dict) -> datetime:
    return _at(race["date"], race.get("time"))


def weekend_start(race: dict) -> datetime:
    starts = [_at(race[f]["date"], race[f].get("time")) for f in _SESSION_FIELDS if f in race]
    # Old calendars have no session times: assume the weekend opens two days before
    return min(starts) if starts else race_start(race) - timedelta(days=2)


def has_data(body: dict | None) -> bool:
    """False if the response's table (Races, StandingsLists, …) is empty."""
    if body is None:
        return False
    for key, table in body.get("MRData", {}).items():
        if key.endswith("Table") and isinstance(table, dict):
            lists = [v for v in table.values() if isinstance(v, list)]
            return any(lists)
    return True


def ttl_for(
    url: str, now: datetime, races: list[dict] | None, body: dict | None, base_url: str = ""
) -> int | None:
    season, rnd = parse(url, base_url)
    if season is None:
        return DEFAULT_TTL  # e.g. the seasons list

    year = now.year if season == "current" else int(season)
    if year < now.year:
        return None
    if year > now.year or not races:
        return DEFAULT_TTL

    live = any(weekend_start(r) <= now <= race_start(r) + RESULTS_SETTLE for r in races)

    if rnd is None or rnd in ("last", "next"):
        return LIVE_TTL if live else DEFAULT_TTL

    race = next((r for r in races if int(r["round"]) == int(rnd)), None)
    if race is None:
        return DEFAULT_TTL
    if now > race_start(race) + RESULTS_SETTLE:
        return None if has_data(body) else DEFAULT_TTL
    if now >= weekend_start(race):
        return LIVE_TTL
    return DEFAULT_TTL
