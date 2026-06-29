"""
Race Analyst — rule-based per-lap insight engine.

Takes the output of get_full_race_analysis() and produces a list of
4-field insight dicts (headline, key_battles, strategy_watch, lap_mover),
one per lap.

No LLM, no network calls — pure deterministic logic.
"""

from __future__ import annotations
from typing import Optional


# ── Thresholds ────────────────────────────────────────────────────────────────

BATTLE_GAP   = 0.5   # seconds — "a battle"
CLOSE_GAP    = 1.5   # seconds — "close"
COMFORT_GAP  = 3.0   # seconds — "comfortable"
UNDERCUT_WINDOW = 2.5  # gap (s) within which an undercut is plausible
OVERDUE_EXTRA  = 4    # laps beyond avg stint → "overdue"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _last_name(full_name: str) -> str:
    """Extract surname from 'First Last'."""
    parts = full_name.strip().split()
    return parts[-1] if parts else full_name


def _fmt_gap(gap: float) -> str:
    if gap < 0.05:
        return "< 0.1s"
    return f"{gap:.1f}s"


def _stint_avg(all_drivers_data: list[dict]) -> dict[str, float]:
    """
    Compute average stint length per compound across all drivers.
    Returns e.g. {"SOFT": 14.2, "MEDIUM": 22.5, "HARD": 30.1}
    Only considers completed stints (not the final stint which may be cut short).
    """
    compound_lengths: dict[str, list[int]] = {}
    for drv in all_drivers_data:
        stints = drv.get("stints", [])
        for i, stint in enumerate(stints):
            compound = stint.get("compound", "UNKNOWN")
            if compound == "UNKNOWN":
                continue
            length = stint.get("length", 0)
            # Only count completed stints (i.e. not the last stint in the race)
            if i < len(stints) - 1 and length > 2:
                compound_lengths.setdefault(compound, []).append(length)

    return {
        comp: round(sum(lens) / len(lens), 1)
        for comp, lens in compound_lengths.items()
        if lens
    }


# ── Snapshot builder ──────────────────────────────────────────────────────────

def _build_snapshot(
    analysis: dict,
    lap_num: int,
    prev_snapshot: Optional[dict],
) -> dict:
    """
    Build a race-state snapshot for a given lap from the full analysis data.
    Returns a dict with the leaderboard ordered by position, including gaps.
    """
    entries = []
    for drv in analysis["drivers"]:
        lap_data = None
        for ld in drv["laps"]:
            if ld["lap"] == lap_num:
                lap_data = ld
                break
        if lap_data is None or lap_data.get("position") is None:
            continue

        # Previous lap position for this driver
        prev_pos = None
        if prev_snapshot:
            for pe in prev_snapshot["entries"]:
                if pe["code"] == drv["code"]:
                    prev_pos = pe["position"]
                    break

        # How many pit stops completed by this lap
        pits_done = sum(1 for pl in drv.get("pitLaps", []) if pl <= lap_num)
        is_pit_this_lap = lap_num in drv.get("pitLaps", [])

        entries.append({
            "code":       drv["code"],
            "fullName":   drv["fullName"],
            "lastName":   _last_name(drv["fullName"]),
            "team":       drv.get("team", ""),
            "teamColor":  drv.get("teamColor", "#CCC"),
            "position":   lap_data["position"],
            "prevPos":    prev_pos,
            "gapToLeader": lap_data.get("gapToLeader"),
            "lapTime":    lap_data.get("lapTime"),
            "lapTimeStr": lap_data.get("lapTimeStr", "N/A"),
            "compound":   lap_data.get("compound", "UNKNOWN"),
            "tyreLife":   lap_data.get("tyreLife"),
            "isPitLap":   lap_data.get("isPitLap", False) or is_pit_this_lap,
            "pitsDone":   pits_done,
        })

    # Sort by position
    entries.sort(key=lambda e: e["position"])

    # Compute gap to car ahead
    for i, e in enumerate(entries):
        if i == 0:
            e["gapAhead"] = None
        else:
            g1 = e.get("gapToLeader")
            g0 = entries[i - 1].get("gapToLeader")
            if g1 is not None and g0 is not None:
                e["gapAhead"] = round(g1 - g0, 3)
            else:
                e["gapAhead"] = None

    # Position change vs previous lap
    for e in entries:
        if e["prevPos"] is not None:
            e["posChange"] = e["prevPos"] - e["position"]  # positive = gained
        else:
            e["posChange"] = 0

    # Race events this lap
    events_this_lap = [
        ev for ev in analysis.get("raceEvents", [])
        if ev.get("lap") == lap_num
    ]

    # Fastest lap this lap
    fastest_this_lap = None
    fastest_time = None
    for e in entries:
        if e["lapTime"] and e["lapTime"] > 10:
            if fastest_time is None or e["lapTime"] < fastest_time:
                fastest_time = e["lapTime"]
                fastest_this_lap = e

    return {
        "lap":              lap_num,
        "entries":          entries,
        "events":           events_this_lap,
        "fastestThisLap":   fastest_this_lap,
        "fastestTime":      fastest_time,
    }


# ── Field generators ──────────────────────────────────────────────────────────

def _gen_headline(snap: dict, prev_snap: Optional[dict], overall_fl: dict, is_lap1: bool) -> str:
    entries = snap["entries"]
    events  = snap["events"]

    if not entries:
        return "No position data available for this lap."

    leader = entries[0]

    # Priority 1: Lead change
    if prev_snap and prev_snap["entries"]:
        prev_leader_code = prev_snap["entries"][0]["code"]
        if leader["code"] != prev_leader_code:
            return f"{leader['lastName']} takes the lead from {_last_name_by_code(prev_snap['entries'], prev_leader_code)}."

    # Priority 2: Safety car / VSC / Red flag this lap
    for ev in events:
        etype = ev.get("type", "")
        if etype == "RED":
            return "Red flag — race suspended."
        if etype == "SC":
            return f"Safety car deployed on lap {snap['lap']}."
        if etype == "VSC":
            return f"Virtual safety car activated on lap {snap['lap']}."

    # Lap 1 special case
    if is_lap1:
        top3 = [e["lastName"] for e in entries[:3]]
        if len(top3) >= 3:
            return f"{top3[0]} leads through the first corner from {top3[1]} and {top3[2]}."
        return f"{top3[0]} leads after the opening lap." if top3 else "Race underway."

    # Priority 3: Leader gap context
    if len(entries) >= 2:
        gap_to_p2 = entries[1].get("gapAhead")
        p2_name = entries[1]["lastName"]

        # Check if gap is closing
        if prev_snap and len(prev_snap["entries"]) >= 2:
            prev_gap = prev_snap["entries"][1].get("gapAhead")
            if gap_to_p2 is not None and prev_gap is not None:
                delta = prev_gap - gap_to_p2
                if delta > 0.3 and gap_to_p2 < 2.0:
                    return (
                        f"{p2_name} has closed to {_fmt_gap(gap_to_p2)} behind "
                        f"{leader['lastName']}, gaining {_fmt_gap(delta)} this lap."
                    )

        # Big overtake elsewhere
        biggest_gainer = max(entries, key=lambda e: e["posChange"])
        if biggest_gainer["posChange"] >= 3:
            return (
                f"{biggest_gainer['lastName']} surges forward, gaining "
                f"{biggest_gainer['posChange']} places to P{biggest_gainer['position']}."
            )

        # Fastest lap
        fl_entry = snap.get("fastestThisLap")
        if fl_entry and overall_fl and fl_entry["lapTime"]:
            if abs(fl_entry["lapTime"] - overall_fl.get("time", 0)) < 0.001:
                return (
                    f"{fl_entry['lastName']} sets the overall fastest lap "
                    f"({fl_entry['lapTimeStr']}) on {fl_entry['compound']}s "
                    f"(tyre age: {fl_entry['tyreLife'] or '?'} laps)."
                )

        # Default
        if gap_to_p2 is not None:
            comfort = "comfortably" if gap_to_p2 > COMFORT_GAP else "narrowly"
            return f"{leader['lastName']} leads {comfort} by {_fmt_gap(gap_to_p2)} from {p2_name}."

    return f"{leader['lastName']} leads the race."


def _gen_key_battles(snap: dict, is_lap1: bool) -> str:
    entries = snap["entries"]

    if len(entries) < 2:
        return "No close battles on track."

    battles = []
    for i in range(1, len(entries)):
        gap = entries[i].get("gapAhead")
        if gap is None:
            continue
        if gap < CLOSE_GAP:
            attacker = entries[i]
            defender = entries[i - 1]
            tyre_delta = ""
            if attacker["tyreLife"] is not None and defender["tyreLife"] is not None:
                diff = defender["tyreLife"] - attacker["tyreLife"]
                if abs(diff) >= 3:
                    fresher = attacker["lastName"] if diff > 0 else defender["lastName"]
                    tyre_delta = f" {fresher} has {abs(diff)}-lap fresher tyres."

            intensity = "battling" if gap < BATTLE_GAP else "close to"
            drs = " DRS range." if gap < 1.0 else ""
            battles.append({
                "gap": gap,
                "text": (
                    f"{attacker['lastName']} {_fmt_gap(gap)} behind "
                    f"{defender['lastName']} for P{defender['position']}, "
                    f"{intensity}.{drs}{tyre_delta}"
                ),
            })

    if not battles:
        return "No gaps under 1.5s — the field is spread out this lap."

    battles.sort(key=lambda b: b["gap"])
    selected = battles[:3]
    return " ".join(b["text"] for b in selected)


def _gen_strategy_watch(
    snap: dict,
    stint_avgs: dict[str, float],
    total_laps: int,
    is_lap1: bool,
) -> str:
    if is_lap1:
        return "No strategy data yet — first racing lap."

    entries = snap["entries"]
    lap_num = snap["lap"]

    overdue = []
    not_pitted = []
    has_pitted = []

    for e in entries:
        compound = e["compound"]
        tyre_life = e["tyreLife"]

        if e["pitsDone"] == 0:
            not_pitted.append(e)
        else:
            has_pitted.append(e)

        # Check overdue
        if tyre_life is not None and compound in stint_avgs:
            avg = stint_avgs[compound]
            if tyre_life > avg + OVERDUE_EXTRA:
                overdue.append(e)

    parts = []

    # Overdue drivers
    if overdue:
        names = ", ".join(e["lastName"] for e in overdue[:2])
        o = overdue[0]
        parts.append(
            f"{names} overdue on {o['tyreLife']}-lap-old {o['compound'].lower()}s "
            f"(avg stint: {stint_avgs.get(o['compound'], '?')} laps)."
        )

    # Undercut windows — driver on old tires within UNDERCUT_WINDOW of a rival ahead
    for i in range(1, min(len(entries), 10)):
        e = entries[i]
        ahead = entries[i - 1]
        gap = e.get("gapAhead")
        if (gap is not None and gap < UNDERCUT_WINDOW
                and e["tyreLife"] is not None and ahead["tyreLife"] is not None
                and e["tyreLife"] > ahead["tyreLife"] + 5
                and e["pitsDone"] < 2):
            parts.append(
                f"Undercut window open for {e['lastName']} "
                f"({_fmt_gap(gap)} behind {ahead['lastName']})."
            )
            break  # Only report the most relevant one

    # Summary of pit status if race is in mid-phase
    race_pct = lap_num / max(total_laps, 1)
    if 0.2 < race_pct < 0.7 and not_pitted:
        n = len(not_pitted)
        if n <= 3:
            names = ", ".join(e["lastName"] for e in not_pitted)
            parts.append(f"{names} still on {'their' if n > 1 else 'the'} first set.")
        else:
            parts.append(f"{n} drivers yet to make their first stop.")

    if not parts:
        # Fallback: oldest tyre on grid
        oldest = max(
            (e for e in entries if e["tyreLife"] is not None),
            key=lambda e: e["tyreLife"],
            default=None,
        )
        if oldest and oldest["tyreLife"] and oldest["tyreLife"] > 10:
            parts.append(
                f"Oldest rubber: {oldest['lastName']} on {oldest['tyreLife']}-lap "
                f"{oldest['compound'].lower()}s."
            )
        else:
            parts.append("The strategic picture is stable this lap.")

    return " ".join(parts[:3])


def _gen_lap_mover(snap: dict, prev_snap: Optional[dict], is_lap1: bool) -> str:
    entries = snap["entries"]

    if not entries:
        return "No position data available."

    # Biggest gainer
    gainer = max(entries, key=lambda e: e["posChange"])
    # Biggest loser
    loser  = min(entries, key=lambda e: e["posChange"])

    # Fastest lap this lap
    fl = snap.get("fastestThisLap")

    if is_lap1:
        if gainer["posChange"] > 0:
            return (
                f"{gainer['lastName']} best start — gained "
                f"{gainer['posChange']} place{'s' if gainer['posChange'] > 1 else ''} "
                f"to P{gainer['position']} off the line."
            )
        return "Clean getaway with no significant position changes at the start."

    parts = []

    if gainer["posChange"] >= 2:
        parts.append(
            f"{gainer['lastName']} gained {gainer['posChange']} places to P{gainer['position']}"
        )
    elif gainer["posChange"] == 1:
        parts.append(
            f"{gainer['lastName']} moved up to P{gainer['position']}"
        )

    if loser["posChange"] <= -2 and loser["code"] != gainer["code"]:
        verb = "dropped" if loser["posChange"] <= -3 else "lost a place"
        parts.append(
            f"{loser['lastName']} {verb} to P{loser['position']}"
        )

    if fl and fl.get("lapTime") and fl["lapTime"] > 10:
        tyre_ctx = f" on {fl['tyreLife']}-lap {fl['compound'].lower()}s" if fl.get("tyreLife") else ""
        parts.append(
            f"{fl['lastName']} set the fastest lap ({fl['lapTimeStr']}){tyre_ctx}"
        )

    if not parts:
        return "A quiet lap with no significant position changes."

    # Combine — pick at most 2 parts to stay within budget
    return "; ".join(parts[:2]) + "."


# ── Helpers ───────────────────────────────────────────────────────────────────

def _last_name_by_code(entries: list[dict], code: str) -> str:
    for e in entries:
        if e["code"] == code:
            return e["lastName"]
    return code


# ── Main entry point ──────────────────────────────────────────────────────────

def analyze_race(analysis: dict) -> list[dict]:
    """
    Process the output of get_full_race_analysis() and return
    one insight dict per lap.

    Parameters
    ----------
    analysis : dict
        The full race analysis data as returned by get_full_race_analysis().

    Returns
    -------
    list[dict]
        Each dict has keys: lap, headline, key_battles, strategy_watch, lap_mover.
    """
    total_laps = analysis.get("totalLaps", 0)
    overall_fl = analysis.get("overallFastestLap", {})

    # Pre-compute average stint lengths
    stint_avgs = _stint_avg(analysis.get("drivers", []))

    insights = []
    prev_snap = None

    for lap_num in range(1, total_laps + 1):
        snap = _build_snapshot(analysis, lap_num, prev_snap)
        is_lap1 = (lap_num == 1)

        headline       = _gen_headline(snap, prev_snap, overall_fl, is_lap1)
        key_battles    = _gen_key_battles(snap, is_lap1)
        strategy_watch = _gen_strategy_watch(snap, stint_avgs, total_laps, is_lap1)
        lap_mover      = _gen_lap_mover(snap, prev_snap, is_lap1)

        insights.append({
            "lap":            lap_num,
            "headline":       headline,
            "key_battles":    key_battles,
            "strategy_watch": strategy_watch,
            "lap_mover":      lap_mover,
        })

        prev_snap = snap

    return insights
