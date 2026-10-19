"""
In-process scheduler (APScheduler) that precomputes each race after it ends.

- For every race in the default season's calendar, one job runs at the
  scheduled race start + PRECOMPUTE_DELAY_HOURS.
- The plan is rebuilt at startup and then daily (calendars change).
- A run missed in the last CATCH_UP window (e.g. the API was down) is done
  on the next plan if that race isn't stored yet. There is deliberately no
  full-season backfill: most seasons have no reachable timing data, and each
  failed load spends FastF1's 500 calls/hour budget. Use the CLI for those.

Runs inside the API process because that process owns the precomputed store
(see precomputed.py). With several API workers, enable it in one only
(PRECOMPUTE_ENABLED=false elsewhere).
"""

import logging
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger

import ergast
from cache_policy import race_start
from errors import AppError
from jobs.precompute import precompute_race
from precomputed import read_or_none, store
from settings import settings

logger = logging.getLogger(__name__)

CATCH_UP = timedelta(days=1)


def planned_runs(
    races: list[dict], now: datetime, delay: timedelta, is_stored
) -> Iterator[tuple[int, int, datetime]]:
    """(season, round, run_at) for races to precompute; past-due runs are moved to now."""
    for race in races:
        run_at = race_start(race) + delay
        season, rnd = int(race["season"]), int(race["round"])
        if run_at > now:
            yield season, rnd, run_at
        elif now - run_at <= CATCH_UP and not is_stored(season, rnd):
            yield season, rnd, now


def run_job(season: int, round_num: int) -> None:
    try:
        precompute_race(season, round_num, store)
        logger.info("Precomputed race analysis for %s R%s", season, round_num)
    except AppError as e:
        logger.warning("Precompute %s R%s skipped: %s", season, round_num, e.message)
    except Exception:
        logger.exception("Precompute %s R%s failed", season, round_num)


def plan(scheduler: BackgroundScheduler) -> None:
    try:
        races = ergast.get_schedule(settings.default_season)["races"]
    except AppError as e:
        logger.warning("Couldn't plan precompute jobs (%s); retrying tomorrow", e.message)
        return

    delay = timedelta(hours=settings.precompute_delay_hours)
    now = datetime.now(UTC)

    def is_stored(season, rnd):
        return read_or_none(season, rnd, "race_analysis") is not None

    count = 0
    for season, rnd, run_at in planned_runs(races, now, delay, is_stored):
        scheduler.add_job(
            run_job,
            DateTrigger(run_date=run_at),
            args=[season, rnd],
            id=f"precompute-{season}-{rnd}",
            replace_existing=True,
            misfire_grace_time=int(CATCH_UP.total_seconds()),
        )
        count += 1
    logger.info("Planned %d precompute job(s) for season %s", count, settings.default_season)


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone=UTC)
    # Re-plan daily; the first run happens right away
    scheduler.add_job(
        plan,
        "interval",
        days=1,
        args=[scheduler],
        id="precompute-plan",
        next_run_time=datetime.now(UTC),
    )
    scheduler.start()
    return scheduler
