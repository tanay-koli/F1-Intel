"""
FastF1 telemetry module
Provides speed traces and multi-metric overlays for driver comparison,
plus full-race lap-by-lap data (lap times, positions, tyre strategy).
Cache is stored in ./f1_cache relative to this file (auto-created).

Seasons from openf1.FIRST_YEAR on come from OpenF1 instead (FastF1 can't
load them); both sources produce the same JSON.
"""

import functools
import logging
import threading
from collections import OrderedDict

import fastf1
import numpy as np
import pandas as pd
from fastf1._api import SessionNotAvailableError
from fastf1.exceptions import (
    DataNotLoadedError,
    InvalidSessionError,
    NoLapDataError,
    RateLimitExceededError,
)

import openf1
from ergast import TEAM_COLORS
from errors import AppError, DataNotAvailable, InvalidInput, NotFound, RateLimited
from settings import settings

logger = logging.getLogger(__name__)

# ── Cache setup ────────────────────────────────────────────────────────────────

CACHE_DIR = settings.cache_dir
CACHE_DIR.mkdir(parents=True, exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))


# ── Helpers ───────────────────────────────────────────────────────────────────

# One lock per key, so concurrent requests for the same session (or analysis)
# wait for the first one instead of all downloading it at once.
_key_locks: dict[tuple, threading.Lock] = {}
_key_locks_guard = threading.Lock()


def _lock_for(key: tuple) -> threading.Lock:
    with _key_locks_guard:
        return _key_locks.setdefault(key, threading.Lock())


def _fastf1_errors(fn):
    """
    Translate FastF1 exceptions from a public function (first two args:
    year, round_num) into app errors with messages a user can act on.
    FastF1 seasons outside settings.telemetry_seasons fail at once, without a load.
    """

    @functools.wraps(fn)
    def wrapper(year, round_num, *args, **kwargs):
        available = settings.telemetry_seasons
        if available and year not in available and year < openf1.FIRST_YEAR:
            raise DataNotAvailable(
                f"Lap and telemetry data isn't available for {year}. It's available for "
                f"{', '.join(map(str, sorted(available)))} and from {openf1.FIRST_YEAR} on."
            )
        try:
            return fn(year, round_num, *args, **kwargs)
        except AppError:
            raise
        except RateLimitExceededError as e:
            raise RateLimited(
                "Too many requests to F1's timing service this hour. Try again later."
            ) from e
        except (DataNotLoadedError, NoLapDataError, SessionNotAvailableError) as e:
            raise DataNotAvailable(
                f"Lap and telemetry data for {year} round {round_num} isn't available "
                "from F1's timing service."
            ) from e
        except InvalidSessionError as e:
            raise NotFound(f"That session doesn't exist for {year} round {round_num}.") from e
        except ValueError as e:
            # FastF1's schedule lookup: "Invalid round: 30", "Invalid session type 'XX'"
            if "Invalid round" in str(e):
                raise NotFound(f"There's no round {round_num} in {year}.") from e
            if "Invalid session type" in str(e):
                raise InvalidInput("Unknown session. Use R, Q, S, SQ, FP1, FP2 or FP3.") from e
            raise

    return wrapper


def _load_session(year: int, round_num: int, session_type: str = "R"):
    """Load & cache a FastF1 session. session_type: R=Race, Q=Qualifying, FP1/FP2/FP3."""
    # Later callers for the same session wait, then hit FastF1's disk cache.
    with _lock_for(("session", year, round_num, session_type)):
        session = fastf1.get_session(year, round_num, session_type)
        # messages: race control (safety cars, red flags) for race events
        session.load(telemetry=True, laps=True, weather=False, messages=True)
    return session


def _driver_team_color(info) -> str:
    """
    Team colour for a FastF1 driver record. FastF1 leaves TeamColor empty when
    timing data can't be loaded, so fall back to our palette by TeamId (which
    matches the Jolpica constructorId), then to grey.
    """
    color = info.get("TeamColor")
    if isinstance(color, str) and len(color) == 6:
        return f"#{color}"
    return TEAM_COLORS.get(info.get("TeamId") or "", "#CCCCCC")


def _lap_time_to_seconds(lt) -> float | None:
    """Convert a pandas Timedelta lap time to seconds, or None if invalid."""
    try:
        if pd.isnull(lt):
            return None
        return round(lt.total_seconds(), 3)
    except Exception:
        return None


def _format_lap_time(lt) -> str:
    """Convert a pandas Timedelta lap time to m:ss.mmm string."""
    try:
        if pd.isnull(lt):
            return "N/A"
        return _seconds_str(lt.total_seconds())
    except Exception:
        return "N/A"


def _seconds_str(seconds: float | None) -> str:
    """Seconds as m:ss.mmm, or "N/A"."""
    return f"{int(seconds // 60)}:{seconds % 60:06.3f}" if seconds else "N/A"


# ── Driver list for a session ─────────────────────────────────────────────────


@_fastf1_errors
def get_session_drivers(year: int, round_num: int, session_type: str = "R") -> dict:
    """Return list of drivers that have laps in the given session."""
    if year >= openf1.FIRST_YEAR:
        drivers = openf1.session_drivers(year, round_num, session_type)
        return {"year": year, "round": round_num, "session": session_type, "drivers": drivers}
    session = _load_session(year, round_num, session_type)
    drivers = []
    for drv in session.drivers:
        try:
            info = session.get_driver(drv)
            drivers.append(
                {
                    "driverId": drv,
                    "code": info.get("Abbreviation", drv),
                    "fullName": f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip(),
                    "teamColor": _driver_team_color(info),
                }
            )
        except Exception:
            continue
    return {"year": year, "round": round_num, "session": session_type, "drivers": drivers}


def classify_race_event(message: str, flag: str) -> str | None:
    """
    Event type for a race-control message, or None. SC/VSC/RED mark the lap
    the period *started*; messages that merely mention one ("SAFETY CAR IN
    THIS LAP", "VIRTUAL SAFETY CAR ENDING", stewards' "SAFETY CAR
    INFRINGEMENT" notes, "RESUME AFTER RED FLAG") are not deployments.
    """
    m = message.upper()
    if "VIRTUAL SAFETY CAR DEPLOYED" in m:
        return "VSC"
    if "SAFETY CAR DEPLOYED" in m:
        return "SC"
    # Not a substring test: "CHEQUERED FLAG" contains "RED FLAG"
    if flag == "RED" or m.startswith("RED FLAG"):
        return "RED"
    if flag == "YELLOW":
        return "YELLOW"
    if flag == "GREEN":
        return "GREEN"
    return None


# ── Full Race Analysis (all drivers) ──────────────────────────────────────────

# Recent analyses kept in memory; /api/race-analyst and /api/telemetry/race-analysis
# both use them, and each one costs a full session load to build.
_ANALYSIS_CACHE_SIZE = 8
_analysis_cache: OrderedDict[tuple[int, int], dict] = OrderedDict()
_analysis_cache_lock = threading.Lock()


@_fastf1_errors
def get_full_race_analysis(year: int, round_num: int) -> dict:
    """Memoised _compute_full_race_analysis(); failures are not cached."""
    key = (year, round_num)
    with _lock_for(("analysis", *key)):
        with _analysis_cache_lock:
            if key in _analysis_cache:
                _analysis_cache.move_to_end(key)
                return _analysis_cache[key]
        result = _compute_full_race_analysis(year, round_num)
        with _analysis_cache_lock:
            _analysis_cache[key] = result
            if len(_analysis_cache) > _ANALYSIS_CACHE_SIZE:
                _analysis_cache.popitem(last=False)
        return result


def _stints(laps_out: list[dict]) -> list[dict]:
    """Tyre stints from consecutive laps on one compound; UNKNOWN laps extend the current one."""
    stints = []
    current_stint = None
    for lap in laps_out:
        if lap["compound"] == "UNKNOWN" and current_stint:
            current_stint["endLap"] = lap["lap"]
            current_stint["length"] += 1
        elif current_stint is None or current_stint["compound"] != lap["compound"]:
            if current_stint:
                stints.append(current_stint)
            current_stint = {
                "compound": lap["compound"],
                "startLap": lap["lap"],
                "endLap": lap["lap"],
                "length": 1,
            }
        else:
            current_stint["endLap"] = lap["lap"]
            current_stint["length"] += 1
    if current_stint:
        stints.append(current_stint)
    return stints


def _driver_entry(
    ident: dict, laps_out: list[dict], pit_laps: list[int], grid_pos, fin_pos
) -> dict:
    """
    One driver's analysis from their per-lap rows. `ident` holds driverId,
    code, fullName, team and teamColor. Shared by the FastF1 and OpenF1 paths.
    """
    # Laps under 10 s are timing glitches
    valid = [lap for lap in laps_out if lap["lapTime"] is not None and lap["lapTime"] > 10]
    fastest = min(
        (lap for lap in valid if lap["lap"] is not None),
        key=lambda lap: lap["lapTime"],
        default=None,
    )
    times = [lap["lapTime"] for lap in valid]
    avg_lap = round(sum(times) / len(times), 3) if times else None
    fastest_time = fastest["lapTime"] if fastest else None
    return {
        **ident,
        "gridPosition": grid_pos,
        "finishPosition": fin_pos,
        "positionsGained": (grid_pos - fin_pos) if grid_pos and fin_pos else None,
        "fastestLap": fastest["lap"] if fastest else None,
        "fastestLapTime": fastest_time,
        "fastestLapTimeStr": _seconds_str(fastest_time),
        "fastestLapCompound": fastest["compound"] if fastest else None,
        "avgLapTime": avg_lap,
        "avgLapTimeStr": _seconds_str(avg_lap),
        "pitStops": len(pit_laps),
        "pitLaps": pit_laps,
        "stints": _stints(laps_out),
        "totalLaps": len(laps_out),
        "laps": laps_out,
    }


def _race_payload(
    year: int, round_num: int, race_name: str, race_events: list[dict], drivers_data: list[dict]
) -> dict:
    """The /api/telemetry/race-analysis response from the drivers' entries."""
    timed = [d for d in drivers_data if d["fastestLapTime"] is not None]
    overall = min(timed, key=lambda d: d["fastestLapTime"], default=None)

    # Sort by finishing position (DNFs at the end)
    drivers_data.sort(key=lambda d: d["finishPosition"] if d["finishPosition"] is not None else 999)

    return {
        "year": year,
        "round": round_num,
        "session": "R",
        "raceName": race_name,
        "totalLaps": max((d["totalLaps"] for d in drivers_data), default=0),
        "overallFastestLap": {
            "driver": overall["code"] if overall else None,
            "lap": overall["fastestLap"] if overall else None,
            "time": overall["fastestLapTime"] if overall else None,
            "timeStr": _seconds_str(overall["fastestLapTime"] if overall else None),
            "compound": overall["fastestLapCompound"] if overall else None,
        },
        "raceEvents": race_events,
        "drivers": drivers_data,
    }


def _openf1_race_analysis(year: int, round_num: int) -> dict:
    race = openf1.race(year, round_num)
    events = [
        {"type": event_type, "lap": lap, "message": message}
        for lap, message, flag in race["control"]
        if (event_type := classify_race_event(message, flag))
    ]
    drivers_data = [
        _driver_entry(
            {k: d[k] for k in ("driverId", "code", "fullName", "team", "teamColor")},
            [{**lap, "lapTimeStr": _seconds_str(lap["lapTime"])} for lap in d["laps"]],
            d["pitLaps"],
            d["grid"],
            d["finish"],
        )
        for d in race["drivers"]
    ]
    return _race_payload(year, round_num, race["raceName"], events, drivers_data)


def _compute_full_race_analysis(year: int, round_num: int) -> dict:
    """
    Returns comprehensive race analysis for ALL drivers:
    - Per-driver: grid pos, finish pos, fastest lap, avg lap, pit stops,
      tyre strategy (stints), lap-by-lap data
    - Race-level: overall fastest lap, safety car periods, total laps
    """
    if year >= openf1.FIRST_YEAR:
        return _openf1_race_analysis(year, round_num)
    session = _load_session(year, round_num, "R")
    all_laps = session.laps
    # Starting grid by driver number; 0 = pit-lane start or unknown
    grid_by_driver = session.results["GridPosition"].to_dict()

    # ── Race control messages (SC / VSC / Red Flag) ───────────────────────
    race_events = []
    try:
        rcm = session.race_control_messages
        if rcm is not None and len(rcm) > 0:
            for _, msg in rcm.iterrows():
                message = str(msg.get("Message", "")).strip()
                flag = str(msg.get("Flag", "")).strip()
                lap_num = msg.get("Lap")
                try:
                    lap_num = int(lap_num) if not pd.isnull(lap_num) else None
                except Exception:
                    lap_num = None

                event_type = classify_race_event(message, flag)

                if event_type:
                    race_events.append(
                        {
                            "type": event_type,
                            "lap": lap_num,
                            "message": message,
                        }
                    )
    except Exception:
        pass  # race control messages not available for all sessions

    # ── Process every driver ──────────────────────────────────────────────
    drivers_data = []

    for drv in session.drivers:
        try:
            info = session.get_driver(drv)
            drv_code = info.get("Abbreviation", drv)
            full_name = f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip()
            team = info.get("TeamName", "Unknown")
            team_color = _driver_team_color(info)
        except Exception:
            drv_code = str(drv)
            full_name = str(drv)
            team = "Unknown"
            team_color = "#CCCCCC"

        drv_laps = all_laps.pick_drivers(drv).copy()
        if len(drv_laps) == 0:
            continue
        drv_laps = drv_laps.sort_values("LapNumber").reset_index(drop=True)

        laps_out = []
        pit_laps = []

        for _, row in drv_laps.iterrows():
            lap_num = int(row["LapNumber"]) if not pd.isnull(row["LapNumber"]) else None
            lap_time_s = _lap_time_to_seconds(row.get("LapTime"))
            lap_time_str = _format_lap_time(row.get("LapTime"))
            compound = (
                str(row.get("Compound", "UNKNOWN"))
                if not pd.isnull(row.get("Compound", float("nan")))
                else "UNKNOWN"
            )
            tyre_life = (
                int(row["TyreLife"]) if not pd.isnull(row.get("TyreLife", float("nan"))) else None
            )

            pos = row.get("Position")
            position = int(pos) if not pd.isnull(pos) else None

            gap = row.get("GapToLeader")
            try:
                gap_s = round(gap.total_seconds(), 3) if not pd.isnull(gap) else None
            except Exception:
                gap_s = None

            try:
                is_pit_lap = not pd.isnull(row.get("PitInTime"))
            except Exception:
                is_pit_lap = False

            if is_pit_lap and lap_num is not None:
                pit_laps.append(lap_num)

            laps_out.append(
                {
                    "lap": lap_num,
                    "lapTime": lap_time_s,
                    "lapTimeStr": lap_time_str,
                    "position": position,
                    "gapToLeader": gap_s,
                    "compound": compound,
                    "tyreLife": tyre_life,
                    "isPitLap": bool(is_pit_lap),
                }
            )

        grid = grid_by_driver.get(drv)
        grid_pos = int(grid) if grid is not None and not pd.isnull(grid) and grid > 0 else None
        fin_pos = laps_out[-1]["position"] if laps_out else None
        ident = {
            "driverId": str(drv),
            "code": drv_code,
            "fullName": full_name,
            "team": team,
            "teamColor": team_color,
        }
        drivers_data.append(_driver_entry(ident, laps_out, pit_laps, grid_pos, fin_pos))

    return _race_payload(
        year, round_num, session.event.get("EventName", ""), race_events, drivers_data
    )


# ── Speed trace comparison ────────────────────────────────────────────────────


@_fastf1_errors
def get_speed_trace(
    year: int,
    round_num: int,
    session_type: str,
    driver1: str,
    driver2: str,
    n_points: int = 500,
) -> dict:
    """
    Returns speed (km/h) vs distance (m) traces for two drivers on their
    respective fastest laps in the given session.
    Returns a unified distance axis and per-driver speed arrays.
    """
    if year >= openf1.FIRST_YEAR:
        traces = []
        for drv in (driver1, driver2):
            ident, seconds, tel = openf1.fastest_lap(year, round_num, session_type, drv)
            info = {k: ident[k] for k in ("code", "fullName", "teamColor")}
            traces.append(({**info, "lapTime": _seconds_str(seconds)}, tel))
        race_name = openf1.scheduled_race(year, round_num)["raceName"]
        return _speed_trace_payload(year, round_num, session_type, race_name, traces, n_points)

    session = _load_session(year, round_num, session_type)

    def _fastest_tel(drv_code: str):
        lap = session.laps.pick_drivers(drv_code).pick_fastest()
        if lap is None or lap.empty:
            raise NotFound(f"No timed laps for driver {drv_code} in this session.")
        tel = lap.get_telemetry()
        # Normalise distance to metres from 0
        tel["Distance"] = tel["Distance"] - tel["Distance"].iloc[0]
        return tel

    def _drv_info(drv_code: str) -> dict:
        try:
            info = session.get_driver(drv_code)
            return {
                "code": info.get("Abbreviation", drv_code),
                "fullName": f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip(),
                "teamColor": _driver_team_color(info),
                "lapTime": _format_lap_time(
                    session.laps.pick_drivers(drv_code).pick_fastest()["LapTime"]
                ),
            }
        except Exception:
            return {
                "code": drv_code,
                "fullName": drv_code,
                "teamColor": "#CCCCCC",
                "lapTime": "N/A",
            }

    traces = [(_drv_info(drv), _fastest_tel(drv)) for drv in (driver1, driver2)]
    return _speed_trace_payload(
        year, round_num, session_type, session.event.get("EventName", ""), traces, n_points
    )


def _speed_trace_payload(
    year: int,
    round_num: int,
    session_type: str,
    race_name: str,
    traces: list[tuple[dict, pd.DataFrame]],
    n_points: int,
) -> dict:
    """
    The /api/telemetry response from two (driver info, telemetry) pairs; the
    telemetry has Distance (m from 0), Speed, Throttle, Brake and nGear columns.
    """
    # Build a unified distance axis from 0 to the shorter lap's distance
    max_dist = min(tel["Distance"].max() for _, tel in traces)
    distance_axis = np.linspace(0, max_dist, n_points)

    # Output key -> telemetry column; gear is a whole number, the rest 1 dp
    channels = {"speed": "Speed", "throttle": "Throttle", "brake": "Brake", "gear": "nGear"}

    def _traces(tel: pd.DataFrame) -> dict:
        out = {}
        for key, col in channels.items():
            values = np.interp(distance_axis, tel["Distance"].values, tel[col].values.astype(float))
            out[key] = [int(round(v)) if key == "gear" else round(float(v), 1) for v in values]
        return out

    (info1, tel1), (info2, tel2) = traces
    return {
        "year": year,
        "round": round_num,
        "session": session_type,
        "raceName": race_name,
        "distance": [round(float(d), 1) for d in distance_axis],
        "driver1": {**info1, **_traces(tel1)},
        "driver2": {**info2, **_traces(tel2)},
    }
