"""
Smoke check: call every API route against a running server and report
status, latency and response shape.

Usage (from backend/, with the API running):
    python scripts/smoke_check.py                         # print table
    python scripts/smoke_check.py --save baseline.json    # record a baseline
    python scripts/smoke_check.py --compare baseline.json # diff against it

The "shape" is the set of JSON paths and value types in the body, so a
compare flags any route whose JSON structure changed, not just its status.
Stdlib only, so it runs in any environment.
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

# (label, method, path). Telemetry uses a past race with published timing data.
ROUTES = [
    ("root", "GET", "/"),
    ("drivers", "GET", "/api/drivers?season=2026"),
    ("driver-standings", "GET", "/api/driver-standings?season=2026"),
    ("driver-standings 2024", "GET", "/api/driver-standings?season=2024"),
    # entries excluded from the championship have no position in Jolpica
    ("driver-standings 1985", "GET", "/api/driver-standings?season=1985"),
    ("constructor-standings 2007", "GET", "/api/constructor-standings?season=2007"),
    ("driver profile", "GET", "/api/drivers/norris?season=2026"),
    ("driver profile 404", "GET", "/api/drivers/nobody?season=2026"),
    ("constructors", "GET", "/api/constructors?season=2026"),
    ("constructor-standings", "GET", "/api/constructor-standings?season=2026"),
    ("constructor profile", "GET", "/api/constructors/ferrari?season=2026"),
    ("circuits", "GET", "/api/circuits?season=2026"),
    ("circuit detail", "GET", "/api/circuits/monza?season=2026"),
    ("seasons", "GET", "/api/seasons"),
    ("schedule", "GET", "/api/schedule?season=2026"),
    ("results last", "GET", "/api/results?season=2026&round=last"),
    ("results 2024 r1", "GET", "/api/results?season=2024&round=1"),
    ("qualifying", "GET", "/api/qualifying?season=2026&round=last"),
    ("driver-progression", "GET", "/api/driver-progression?season=2024"),
    ("constructor-progression", "GET", "/api/constructor-progression?season=2024"),
    ("sprint", "GET", "/api/sprint?season=2026&round=17"),
    ("pitstops", "GET", "/api/pitstops?season=2026&round=last"),
    ("h2h", "GET", "/api/h2h?season=2026&driver1=norris&driver2=piastri"),
    ("next-race", "GET", "/api/next-race?season=2026"),
    ("next-race 2024", "GET", "/api/next-race?season=2024"),
    ("circuit-outline", "GET", "/api/circuit-outline?circuit_id=monza"),
    ("telemetry drivers", "GET", "/api/telemetry/drivers?year=2025&round=16&session=R"),
    (
        "telemetry trace",
        "GET",
        "/api/telemetry?year=2025&round=16&session=Q&driver1=VER&driver2=NOR",
    ),
    ("race-analysis", "GET", "/api/telemetry/race-analysis?year=2025&round=16"),
    ("race-analyst", "GET", "/api/race-analyst?year=2025&round=16"),
    # 2021-2022 are the only seasons whose timing data is still reachable
    # (FastF1's mirror); F1's own server returns 401. See CLAUDE.md.
    ("telemetry drivers 2022", "GET", "/api/telemetry/drivers?year=2022&round=16&session=R"),
    (
        "telemetry trace 2022",
        "GET",
        "/api/telemetry?year=2022&round=16&session=Q&driver1=VER&driver2=LEC",
    ),
    ("race-analysis 2022", "GET", "/api/telemetry/race-analysis?year=2022&round=16"),
    ("race-analyst 2022", "GET", "/api/race-analyst?year=2022&round=16"),
    ("cache stats", "GET", "/api/cache/stats"),
    # expired_only so the check never wipes the whole cache
    ("cache clear", "DELETE", "/api/cache/clear?expired_only=true"),
    # bad input: should become a clean 422 once validation lands
    ("bad season", "GET", "/api/driver-standings?season=abc"),
    ("bad round", "GET", "/api/results?season=2026&round=-3"),
]


def shape(value, path="$", out=None):
    """Flatten a JSON value into a set of 'path:type' strings."""
    out = set() if out is None else out
    if isinstance(value, dict):
        out.add(f"{path}:object")
        for k, v in value.items():
            shape(v, f"{path}.{k}", out)
    elif isinstance(value, list):
        out.add(f"{path}:array")
        for item in value:
            shape(item, f"{path}[]", out)
    else:
        out.add(f"{path}:{type(value).__name__}")
    return out


def call(base, method, path, timeout):
    req = urllib.request.Request(base + path, method=method)
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status, body = resp.status, resp.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    except Exception as e:  # timeout, connection refused
        return {
            "status": 0,
            "ms": round((time.perf_counter() - start) * 1000),
            "error": f"{type(e).__name__}: {e}",
            "shape": [],
        }
    ms = round((time.perf_counter() - start) * 1000)
    try:
        data = json.loads(body)
    except ValueError:
        return {"status": status, "ms": ms, "error": "non-JSON body", "shape": []}
    error = ""
    if status >= 400 and isinstance(data, dict):
        error = str(data.get("message") or data.get("detail") or data)[:120]
    return {"status": status, "ms": ms, "error": error, "shape": sorted(shape(data))}


def run(base, timeout):
    results = {}
    for label, method, path in ROUTES:
        r = call(base, method, path, timeout)
        r["path"] = f"{method} {path}"
        results[label] = r
        print(f"  {r['status'] or 'ERR':>3} {r['ms']:>6} ms  {label}", file=sys.stderr)
    return results


def ok(status):
    return 200 <= status < 300


def table(current, baseline=None):
    lines = []
    if baseline is None:
        lines.append("| Endpoint | Status | ms | Error |")
        lines.append("|---|---|---|---|")
        for label, r in current.items():
            lines.append(f"| {label} | {r['status']} | {r['ms']} | {r['error']} |")
        return "\n".join(lines)

    lines.append("| Endpoint | Before | After | ms before → after | Shape | Error now |")
    lines.append("|---|---|---|---|---|---|")
    for label, r in current.items():
        b = baseline.get(label)
        if b is None:
            lines.append(f"| {label} | — | {r['status']} | — → {r['ms']} | new | {r['error']} |")
            continue
        if ok(b["status"]) and ok(r["status"]):
            shape_note = "same" if b["shape"] == r["shape"] else "**CHANGED**"
        else:
            shape_note = "n/a"
        flag = " ⚠" if ok(b["status"]) and not ok(r["status"]) else ""
        lines.append(
            f"| {label} | {b['status']} | {r['status']}{flag} | {b['ms']} → {r['ms']} "
            f"| {shape_note} | {r['error']} |"
        )
    return "\n".join(lines)


def shape_diffs(current, baseline):
    """Detail for routes whose successful JSON shape changed."""
    out = []
    for label, r in current.items():
        b = baseline.get(label)
        if b and ok(b["status"]) and ok(r["status"]) and b["shape"] != r["shape"]:
            removed = sorted(set(b["shape"]) - set(r["shape"]))
            added = sorted(set(r["shape"]) - set(b["shape"]))
            out.append(f"\n{label}:\n  removed: {removed[:10]}\n  added:   {added[:10]}")
    return "".join(out)


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    # Not "localhost": it tries IPv6 first, adding ~2 s per call on Windows
    ap.add_argument("--base", default="http://127.0.0.1:8000")
    ap.add_argument("--timeout", type=float, default=180)
    ap.add_argument("--save", metavar="FILE")
    ap.add_argument("--compare", metavar="FILE")
    args = ap.parse_args()

    current = run(args.base, args.timeout)
    if args.save:
        with open(args.save, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=1)
    baseline = None
    if args.compare:
        with open(args.compare, encoding="utf-8") as f:
            baseline = json.load(f)
    print(table(current, baseline))
    if baseline:
        print(shape_diffs(current, baseline))
        regressions = [
            k
            for k, r in current.items()
            if k in baseline and ok(baseline[k]["status"]) and not ok(r["status"])
        ]
        if regressions:
            print(f"\nREGRESSIONS: {', '.join(regressions)}")
            sys.exit(1)


if __name__ == "__main__":
    main()
