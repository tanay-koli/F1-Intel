"""
OpenF1 client (https://openf1.org): lap, gap, tyre, race-control and car data
from 2023 onwards, the seasons FastF1 can't load (see CLAUDE.md).

Historical data is free without a login; the free tier allows 3 requests/s
and 30/min. Functions here fetch and reshape into plain rows; telemetry.py
builds the API payloads from them, the same way it does from FastF1.
"""

import functools
import logging
import threading
import time
from bisect import bisect_right
from datetime import UTC, datetime, timedelta
from urllib.parse import quote, urlencode

import pandas as pd
import requests

import ergast
from cache_policy import race_start
from errors import DataNotAvailable, NotFound, RateLimited, UpstreamError

logger = logging.getLogger(__name__)

BASE_URL = "https://api.openf1.org/v1"
FIRST_YEAR = 2023
TIMEOUT = 30
_MIN_INTERVAL = 0.35  # seconds between requests: the free tier allows 3/s

# FastF1 session codes -> OpenF1 session_name
SESSION_NAMES = {
    "R": "Race",
    "Q": "Qualifying",
    "S": "Sprint",
    "SQ": "Sprint Qualifying",
    "SS": "Sprint Qualifying",
    "FP1": "Practice 1",
    "FP2": "Practice 2",
    "FP3": "Practice 3",
}

_throttle = threading.Lock()
_last_call = 0.0


# shortcut: raw responses aren't cached (/intervals is MBs per race);
# finished payloads are cached by telemetry's in-memory LRU and the precomputed store.
def _get(path: str, params: dict, filters: str = "") -> list[dict]:
    """GET /v1/<path>; `filters` holds comparison filters like 'date>=…'."""
    global _last_call
    with _throttle:
        wait = _last_call + _MIN_INTERVAL - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_call = time.monotonic()

    url = f"{BASE_URL}/{path}?{urlencode(params)}" + (f"&{filters}" if filters else "")
    try:
        resp = requests.get(url, timeout=TIMEOUT)
    except requests.RequestException as e:
        logger.warning("OpenF1 request failed: %s (%s)", url, e)
        raise UpstreamError() from e

    if resp.status_code == 429:
        logger.warning("OpenF1 rate limit hit: %s", url)
        raise RateLimited("Too many requests to OpenF1 this minute. Try again shortly.")
    if resp.status_code == 404:
        return []  # OpenF1 answers "No results found." with a 404
    if resp.status_code >= 400:
        logger.warning("OpenF1 returned %s for %s", resp.status_code, url)
        raise UpstreamError()
    try:
        data = resp.json()
    except ValueError as e:
        raise UpstreamError() from e
    if not isinstance(data, list):
        raise UpstreamError()
    return data


def _time(value: str) -> datetime:
    return datetime.fromisoformat(value)


# ── Sessions ──────────────────────────────────────────────────────────────────


def scheduled_race(year: int, round_num: int) -> dict:
    """The round's entry in the Jolpica schedule (raceName, date, time, …)."""
    race = next(
        (r for r in ergast.get_schedule(str(year))["races"] if r["round"] == round_num), None
    )
    if race is None:
        raise NotFound(f"There's no round {round_num} in {year}.")
    return race


@functools.lru_cache(maxsize=256)
def session_key(year: int, round_num: int, session_type: str) -> int:
    """OpenF1 session_key for a round; OpenF1 has no round numbers, so match on race start."""
    start = race_start(scheduled_race(year, round_num))

    races = _get("sessions", {"year": year, "session_name": "Race"})
    best = min(races, key=lambda s: abs(_time(s["date_start"]) - start), default=None)
    # Match on time, not date: night races start on the next UTC day
    if best is None or abs(_time(best["date_start"]) - start) > timedelta(days=1):
        raise DataNotAvailable(f"OpenF1 has no data for {year} round {round_num} yet.")
    if session_type == "R":
        return best["session_key"]

    sessions = _get(
        "sessions",
        {"meeting_key": best["meeting_key"], "session_name": SESSION_NAMES[session_type]},
    )
    if not sessions:
        raise NotFound(f"That session doesn't exist for {year} round {round_num}.")
    return sessions[0]["session_key"]


def _driver_ident(d: dict) -> dict:
    colour = d.get("team_colour")
    return {
        "driverId": str(d["driver_number"]),  # FastF1 also uses the car number
        "code": d.get("name_acronym") or str(d["driver_number"]),
        "fullName": f"{d.get('first_name') or ''} {d.get('last_name') or ''}".strip(),
        "team": d.get("team_name"),
        "teamColor": f"#{colour}" if colour else "#CCCCCC",
    }


def session_drivers(year: int, round_num: int, session_type: str) -> list[dict]:
    key = session_key(year, round_num, session_type)
    return [
        {k: v for k, v in _driver_ident(d).items() if k != "team"}
        for d in _get("drivers", {"session_key": key})
    ]


# ── Race ──────────────────────────────────────────────────────────────────────


def _series(rows: list[dict], field: str) -> dict[int, tuple[list[datetime], list]]:
    """Per driver: (times, values) of a timestamped field, in time order."""
    out: dict[int, tuple[list, list]] = {}
    for r in sorted(rows, key=lambda r: _time(r["date"])):
        times, values = out.setdefault(r["driver_number"], ([], []))
        times.append(_time(r["date"]))
        values.append(r[field])
    return out


def _value_at(series: tuple[list, list] | None, t: datetime | None):
    """Last value recorded at or before t."""
    if not series or t is None:
        return None
    i = bisect_right(series[0], t)
    return series[1][i - 1] if i else None


def _gap(value) -> float | None:
    # Lapped cars have no numeric gap (None or "+1 LAP")
    return round(float(value), 3) if isinstance(value, int | float) else None


_FINISHED = datetime.max.replace(tzinfo=UTC)


def _lap_ends(laps: list[dict]) -> list[datetime | None]:
    """When each of a driver's laps (sorted) was completed: the next lap's start."""
    ends = []
    for i, lap in enumerate(laps):
        if i + 1 < len(laps) and laps[i + 1].get("date_start"):
            ends.append(_time(laps[i + 1]["date_start"]))
        elif lap.get("date_start") and lap.get("lap_duration"):
            ends.append(_time(lap["date_start"]) + timedelta(seconds=lap["lap_duration"]))
        else:
            ends.append(None)
    return ends


def build_race(raw: dict, grid: dict[str, int]) -> dict:
    """
    Plain race rows from OpenF1 responses (`raw`: endpoint name -> rows).
    `grid` maps driver code -> starting position (from Jolpica; OpenF1's
    starting_grid is often empty).
    """
    gaps = _series(raw["intervals"], "gap_to_leader")
    results = {r["driver_number"]: r for r in raw["session_result"]}

    laps_by_driver: dict[int, list[dict]] = {}
    for lap in raw["laps"]:
        laps_by_driver.setdefault(lap["driver_number"], []).append(lap)
    for laps in laps_by_driver.values():
        laps.sort(key=lambda lap: lap["lap_number"])
    ends = {number: _lap_ends(laps) for number, laps in laps_by_driver.items()}

    # A finisher's last lap often has no time at all (no duration, no sectors).
    # They crossed the line, so count it as done after every timed crossing,
    # in classification order (the tie-break below)
    classified = {n: r["position"] for n, r in results.items() if r.get("position")}
    for number, driver_ends in ends.items():
        if driver_ends[-1] is None and number in classified:
            driver_ends[-1] = _FINISHED

    # Position after lap n = order of crossing the line to complete lap n,
    # as FastF1 does; sampling OpenF1's position feed per driver can repeat
    # a position when two cars swap places within a second
    crossings: dict[int, list[tuple[datetime, int, int]]] = {}
    for number, laps in laps_by_driver.items():
        for lap, end in zip(laps, ends[number], strict=True):
            if end is not None:
                tie_break = classified.get(number, 99)
                crossings.setdefault(lap["lap_number"], []).append((end, tie_break, number))
    position = {
        (number, n): rank
        for n, crossed in crossings.items()
        for rank, (_, _, number) in enumerate(sorted(crossed), start=1)
    }

    # Classification order first, so unclassified drivers keep a stable order
    order = [r["driver_number"] for r in raw["session_result"]]
    idents = {d["driver_number"]: d for d in raw["drivers"]}
    order += [n for n in idents if n not in order]

    drivers = []
    for number in order:
        laps = laps_by_driver.get(number, [])
        if not laps or number not in idents:
            continue
        stints = [s for s in raw["stints"] if s["driver_number"] == number]
        pit_laps = sorted(p["lap_number"] for p in raw["pit"] if p["driver_number"] == number)

        rows = []
        for lap, end in zip(laps, ends[number], strict=True):
            n = lap["lap_number"]
            stint = next((s for s in stints if s["lap_start"] <= n <= (s["lap_end"] or n)), None)
            age = stint.get("tyre_age_at_start") if stint else None
            rows.append(
                {
                    "lap": n,
                    "lapTime": lap.get("lap_duration"),
                    "position": position.get((number, n)),
                    "gapToLeader": _gap(_value_at(gaps.get(number), end)),
                    "compound": (stint or {}).get("compound") or "UNKNOWN",
                    # FastF1 counts the current lap: fresh tyres read 1 on their first lap
                    "tyreLife": age + n - stint["lap_start"] + 1 if age is not None else None,
                    "isPitLap": n in pit_laps,
                }
            )

        ident = _driver_ident(idents[number])
        drivers.append(
            {
                **ident,
                "grid": grid.get(ident["code"]),
                "finish": (results.get(number) or {}).get("position"),
                "pitLaps": pit_laps,
                "laps": rows,
            }
        )

    return {
        "raceName": raw["meetings"][0]["meeting_name"] if raw["meetings"] else "",
        "control": [
            (r.get("lap_number"), r.get("message") or "", r.get("flag") or "")
            for r in raw["race_control"]
        ],
        "drivers": drivers,
    }


def _jolpica_grid(year: int, round_num: int) -> dict[str, int]:
    """Driver code -> grid slot; pit-lane starts (grid 0) are left out."""
    try:
        results = ergast.get_race_results(str(year), str(round_num))["results"]
    except NotFound:
        return {}
    return {r["code"]: r["grid"] for r in results if r["grid"] > 0}


RACE_ENDPOINTS = (
    "drivers",
    "intervals",
    "stints",
    "pit",
    "race_control",
    "session_result",
)


def race(year: int, round_num: int) -> dict:
    """A race's rows (see build_race); about 9 OpenF1 calls."""
    key = session_key(year, round_num, "R")
    laps = _get("laps", {"session_key": key})
    if not laps:
        raise DataNotAvailable(f"OpenF1 has no lap data for {year} round {round_num} yet.")
    raw = {name: _get(name, {"session_key": key}) for name in RACE_ENDPOINTS}
    # Without the classification, finishing order is unknown; don't let a
    # half-published race be cached or stored as final
    if not raw["session_result"]:
        raise DataNotAvailable(f"OpenF1 hasn't published the {year} round {round_num} result yet.")
    raw["laps"] = laps
    raw["meetings"] = _get("meetings", {"meeting_key": laps[0]["meeting_key"]})
    return build_race(raw, _jolpica_grid(year, round_num))


# ── Fastest lap telemetry ─────────────────────────────────────────────────────


def car_trace(samples: list[dict]) -> pd.DataFrame:
    """
    Car data as FastF1-style columns. OpenF1 has no distance, so it is
    integrated from speed over time (samples are ~3.7 Hz).
    """
    df = pd.DataFrame(samples)
    t = pd.to_datetime(df["date"], format="ISO8601")
    dt = t.diff().dt.total_seconds().fillna(0)
    mean_speed = (df["speed"] + df["speed"].shift().fillna(df["speed"])) / 2
    return pd.DataFrame(
        {
            "Distance": (mean_speed / 3.6 * dt).cumsum(),
            "Speed": df["speed"],
            "Throttle": df["throttle"],
            "Brake": (df["brake"] > 0).astype(int),  # 0/100 here, a boolean in FastF1
            "nGear": df["n_gear"],
        }
    )


def fastest_lap(
    year: int, round_num: int, session_type: str, driver: str
) -> tuple[dict, float, pd.DataFrame]:
    """(driver ident, lap seconds, car trace) of a driver's fastest lap; driver = number or code."""
    key = session_key(year, round_num, session_type)
    d = next(
        (
            d
            for d in _get("drivers", {"session_key": key})
            if driver in (str(d["driver_number"]), (d.get("name_acronym") or "").upper())
        ),
        None,
    )
    no_laps = NotFound(f"No timed laps for driver {driver} in this session.")
    if d is None:
        raise no_laps
    laps = [
        lap
        for lap in _get("laps", {"session_key": key, "driver_number": d["driver_number"]})
        if lap.get("lap_duration") and lap.get("date_start") and not lap.get("is_pit_out_lap")
    ]
    if not laps:
        raise no_laps
    lap = min(laps, key=lambda lap: lap["lap_duration"])

    start = _time(lap["date_start"])
    end = start + timedelta(seconds=lap["lap_duration"])
    samples = _get(
        "car_data",
        {"session_key": key, "driver_number": d["driver_number"]},
        f"date>={quote(start.isoformat())}&date<{quote(end.isoformat())}",
    )
    if len(samples) < 2:
        raise DataNotAvailable(f"OpenF1 has no car data for {driver}'s fastest lap.")
    return _driver_ident(d), lap["lap_duration"], car_trace(samples)
