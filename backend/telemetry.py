"""
FastF1 telemetry module
Provides speed traces and multi-metric overlays for driver comparison,
plus full-race lap-by-lap data (lap times, positions, tyre strategy).
Cache is stored in ./f1_cache relative to this file (auto-created).
"""

import functools
import logging
import threading
from collections import OrderedDict
from pathlib import Path

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

from ergast import TEAM_COLORS
from errors import AppError, DataNotAvailable, InvalidInput, NotFound, RateLimited

logger = logging.getLogger(__name__)

# ── Cache setup ────────────────────────────────────────────────────────────────

CACHE_DIR = Path(__file__).parent / "f1_cache"
CACHE_DIR.mkdir(exist_ok=True)
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
    """

    @functools.wraps(fn)
    def wrapper(year, round_num, *args, **kwargs):
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
        session.load(telemetry=True, laps=True, weather=False, messages=False)
    return session


def _resample(series: pd.Series, n: int = 500) -> list:
    """Downsample a pandas Series to ~n evenly-spaced float values."""
    arr = series.dropna().values.astype(float)
    if len(arr) == 0:
        return []
    indices = np.linspace(0, len(arr) - 1, min(n, len(arr))).astype(int)
    return [round(float(x), 2) for x in arr[indices]]


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
        total_s = lt.total_seconds()
        mins = int(total_s // 60)
        secs = total_s % 60
        return f"{mins}:{secs:06.3f}"
    except Exception:
        return "N/A"


# ── Driver list for a session ─────────────────────────────────────────────────


@_fastf1_errors
def get_session_drivers(year: int, round_num: int, session_type: str = "R") -> dict:
    """Return list of drivers that have laps in the given session."""
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


# ── Full-race lap-by-lap data ─────────────────────────────────────────────────


@_fastf1_errors
def get_race_lap_data(
    year: int,
    round_num: int,
    driver1: str,
    driver2: str,
) -> dict:
    """
    Returns lap-by-lap race data for two drivers:
    - Lap times (seconds & formatted string)
    - Race position per lap
    - Gap to leader per lap
    - Tyre compound per lap
    - Tyre age (laps on tyre)
    - Pit stop laps
    - Fastest lap highlight
    - Summary stats per driver
    """
    session = _load_session(year, round_num, "R")

    def _drv_info(drv_code: str) -> dict:
        try:
            info = session.get_driver(drv_code)
            return {
                "code": info.get("Abbreviation", drv_code),
                "fullName": f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip(),
                "teamColor": _driver_team_color(info),
            }
        except Exception:
            return {"code": drv_code, "fullName": drv_code, "teamColor": "#CCCCCC"}

    def _build_lap_series(drv_code: str) -> dict:
        drv_laps = session.laps.pick_drivers(drv_code).copy()
        drv_laps = drv_laps.sort_values("LapNumber").reset_index(drop=True)

        laps_out = []
        pit_laps = []
        fastest_lap_num = None
        fastest_lap_time = None

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

            # Position
            pos = row.get("Position")
            position = int(pos) if not pd.isnull(pos) else None

            # Gap to leader — stored as Timedelta, convert to seconds
            gap = row.get("GapToLeader")
            try:
                gap_s = round(gap.total_seconds(), 3) if not pd.isnull(gap) else None
            except Exception:
                gap_s = None

            # Is this a pit lap?
            pit_in_time = row.get("PitInTime")
            try:
                is_pit_lap = not pd.isnull(pit_in_time)
            except Exception:
                is_pit_lap = False

            if is_pit_lap and lap_num is not None:
                pit_laps.append(lap_num)

            # Track fastest lap
            if lap_time_s is not None and lap_num is not None:
                if fastest_lap_time is None or lap_time_s < fastest_lap_time:
                    fastest_lap_time = lap_time_s
                    fastest_lap_num = lap_num

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

        # Summary stats
        valid_times = [
            lap["lapTime"] for lap in laps_out if lap["lapTime"] is not None and lap["lapTime"] > 0
        ]
        avg_lap = round(sum(valid_times) / len(valid_times), 3) if valid_times else None
        fin_pos = laps_out[-1]["position"] if laps_out else None

        return {
            "laps": laps_out,
            "pitLaps": pit_laps,
            "fastestLap": fastest_lap_num,
            "fastestLapTime": fastest_lap_time,
            "fastestLapTimeStr": _format_lap_time(
                drv_laps.pick_fastest()["LapTime"] if len(drv_laps) > 0 else pd.NaT
            )
            if len(drv_laps) > 0
            else "N/A",
            "avgLapTime": avg_lap,
            "finishPosition": fin_pos,
            "totalLaps": len(laps_out),
        }

    info1 = _drv_info(driver1)
    info2 = _drv_info(driver2)
    data1 = _build_lap_series(driver1)
    data2 = _build_lap_series(driver2)

    # Build a unified lap axis
    max_lap = max(
        data1["laps"][-1]["lap"] if data1["laps"] else 0,
        data2["laps"][-1]["lap"] if data2["laps"] else 0,
    )

    return {
        "year": year,
        "round": round_num,
        "session": "R",
        "raceName": session.event.get("EventName", ""),
        "maxLap": max_lap,
        "driver1": {**info1, **data1},
        "driver2": {**info2, **data2},
    }


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


def _compute_full_race_analysis(year: int, round_num: int) -> dict:
    """
    Returns comprehensive race analysis for ALL drivers:
    - Per-driver: grid pos, finish pos, fastest lap, avg lap, pit stops,
      tyre strategy (stints), lap-by-lap data
    - Race-level: overall fastest lap, safety car periods, total laps
    """
    session = _load_session(year, round_num, "R")
    all_laps = session.laps

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

                event_type = None
                if "SAFETY CAR" in message.upper() and "VIRTUAL" not in message.upper():
                    event_type = "SC"
                elif "VIRTUAL SAFETY CAR" in message.upper() or "VSC" in message.upper():
                    event_type = "VSC"
                elif "RED FLAG" in message.upper():
                    event_type = "RED"
                elif flag == "YELLOW":
                    event_type = "YELLOW"
                elif flag == "GREEN" and event_type is None:
                    event_type = "GREEN"

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
    overall_fastest_time = None
    overall_fastest_driver = None
    overall_fastest_lap_num = None
    overall_fastest_compound = None

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
        fastest_lap_num = None
        fastest_lap_time = None
        fastest_lap_compound = None

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

            # Track driver's fastest lap
            if lap_time_s is not None and lap_num is not None and lap_time_s > 10:
                if fastest_lap_time is None or lap_time_s < fastest_lap_time:
                    fastest_lap_time = lap_time_s
                    fastest_lap_num = lap_num
                    fastest_lap_compound = compound

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

        # Build tyre stints
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

        # Summary stats
        valid_times = [
            lap["lapTime"] for lap in laps_out if lap["lapTime"] is not None and lap["lapTime"] > 10
        ]
        avg_lap = round(sum(valid_times) / len(valid_times), 3) if valid_times else None

        grid_pos = laps_out[0]["position"] if laps_out and laps_out[0]["position"] else None
        fin_pos = laps_out[-1]["position"] if laps_out else None
        positions_gained = (grid_pos - fin_pos) if grid_pos and fin_pos else None

        # Track overall race fastest lap
        if fastest_lap_time is not None:
            if overall_fastest_time is None or fastest_lap_time < overall_fastest_time:
                overall_fastest_time = fastest_lap_time
                overall_fastest_driver = drv_code
                overall_fastest_lap_num = fastest_lap_num
                overall_fastest_compound = fastest_lap_compound

        drivers_data.append(
            {
                "driverId": str(drv),
                "code": drv_code,
                "fullName": full_name,
                "team": team,
                "teamColor": team_color,
                "gridPosition": grid_pos,
                "finishPosition": fin_pos,
                "positionsGained": positions_gained,
                "fastestLap": fastest_lap_num,
                "fastestLapTime": fastest_lap_time,
                "fastestLapTimeStr": _format_lap_time(pd.Timedelta(seconds=fastest_lap_time))
                if fastest_lap_time
                else "N/A",
                "fastestLapCompound": fastest_lap_compound,
                "avgLapTime": avg_lap,
                "avgLapTimeStr": _format_lap_time(pd.Timedelta(seconds=avg_lap))
                if avg_lap
                else "N/A",
                "pitStops": len(pit_laps),
                "pitLaps": pit_laps,
                "stints": stints,
                "totalLaps": len(laps_out),
                "laps": laps_out,
            }
        )

    # Sort by finishing position (DNFs at the end)
    drivers_data.sort(key=lambda d: d["finishPosition"] if d["finishPosition"] is not None else 999)

    # Determine total race laps
    max_lap = max((d["totalLaps"] for d in drivers_data), default=0)

    return {
        "year": year,
        "round": round_num,
        "session": "R",
        "raceName": session.event.get("EventName", ""),
        "totalLaps": max_lap,
        "overallFastestLap": {
            "driver": overall_fastest_driver,
            "lap": overall_fastest_lap_num,
            "time": overall_fastest_time,
            "timeStr": _format_lap_time(pd.Timedelta(seconds=overall_fastest_time))
            if overall_fastest_time
            else "N/A",
            "compound": overall_fastest_compound,
        },
        "raceEvents": race_events,
        "drivers": drivers_data,
    }


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
    session = _load_session(year, round_num, session_type)

    def _fastest_tel(drv_code: str):
        lap = session.laps.pick_drivers(drv_code).pick_fastest()
        if lap is None or lap.empty:
            raise NotFound(f"No timed laps for driver {drv_code} in this session.")
        tel = lap.get_telemetry()
        # Normalise distance to metres from 0
        tel["Distance"] = tel["Distance"] - tel["Distance"].iloc[0]
        return tel

    tel1 = _fastest_tel(driver1)
    tel2 = _fastest_tel(driver2)

    # Build a unified distance axis from 0 to min(max_dist1, max_dist2)
    max_dist = min(tel1["Distance"].max(), tel2["Distance"].max())
    distance_axis = np.linspace(0, max_dist, n_points)

    def _interp_speed(tel: pd.DataFrame) -> list:
        speeds = np.interp(distance_axis, tel["Distance"].values, tel["Speed"].values)
        return [round(float(s), 1) for s in speeds]

    def _interp_throttle(tel: pd.DataFrame) -> list:
        throttle = np.interp(
            distance_axis, tel["Distance"].values, tel["Throttle"].values.astype(float)
        )
        return [round(float(t), 1) for t in throttle]

    def _interp_brake(tel: pd.DataFrame) -> list:
        brake = np.interp(distance_axis, tel["Distance"].values, tel["Brake"].values.astype(float))
        return [round(float(b), 1) for b in brake]

    def _interp_gear(tel: pd.DataFrame) -> list:
        gear = np.interp(distance_axis, tel["Distance"].values, tel["nGear"].values.astype(float))
        return [int(round(float(g))) for g in gear]

    # Meta
    def _lap_time_str(drv_code: str) -> str:
        lap = session.laps.pick_drivers(drv_code).pick_fastest()
        lt = lap["LapTime"]
        if pd.isnull(lt):
            return "N/A"
        total_s = lt.total_seconds()
        mins = int(total_s // 60)
        secs = total_s % 60
        return f"{mins}:{secs:06.3f}"

    def _drv_info(drv_code: str) -> dict:
        try:
            info = session.get_driver(drv_code)
            return {
                "code": info.get("Abbreviation", drv_code),
                "fullName": f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip(),
                "teamColor": _driver_team_color(info),
                "lapTime": _lap_time_str(drv_code),
            }
        except Exception:
            return {
                "code": drv_code,
                "fullName": drv_code,
                "teamColor": "#CCCCCC",
                "lapTime": "N/A",
            }

    distance_list = [round(float(d), 1) for d in distance_axis]

    return {
        "year": year,
        "round": round_num,
        "session": session_type,
        "raceName": session.event.get("EventName", ""),
        "distance": distance_list,
        "driver1": {
            **_drv_info(driver1),
            "speed": _interp_speed(tel1),
            "throttle": _interp_throttle(tel1),
            "brake": _interp_brake(tel1),
            "gear": _interp_gear(tel1),
        },
        "driver2": {
            **_drv_info(driver2),
            "speed": _interp_speed(tel2),
            "throttle": _interp_throttle(tel2),
            "brake": _interp_brake(tel2),
            "gear": _interp_gear(tel2),
        },
    }
