"""
Check that a slow FastF1 load doesn't stall other requests.

Starts N identical slow requests (default: race analysis for a race that
isn't in the FastF1 cache yet) in background threads, and while they run,
repeatedly times a cheap route. Prints latency stats for both.

Usage (from backend/, API running):
    python scripts/concurrency_check.py --year 2022 --round 1 --parallel 2
Pick a round you haven't loaded before, or the "cold" load is a cache hit.
"""

import argparse
import statistics
import sys
import threading
import time
import urllib.error
import urllib.request


def timed_get(url, timeout=600):
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            status = r.status
            r.read()
    except urllib.error.HTTPError as e:
        status = e.code
    return status, (time.perf_counter() - start) * 1000


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--base", default="http://127.0.0.1:8000")
    ap.add_argument("--year", type=int, default=2022)
    ap.add_argument("--round", type=int, default=1)
    ap.add_argument(
        "--parallel", type=int, default=1, help="identical slow requests to fire at once"
    )
    ap.add_argument("--fast", default="/api/driver-standings?season=2026")
    args = ap.parse_args()

    slow_url = f"{args.base}/api/telemetry/race-analysis?year={args.year}&round={args.round}"
    slow_results = []

    def slow():
        slow_results.append(timed_get(slow_url))

    timed_get(args.base + args.fast)  # warm the fast route's cache first

    threads = [threading.Thread(target=slow) for _ in range(args.parallel)]
    for t in threads:
        t.start()

    fast_ms = []
    while any(t.is_alive() for t in threads):
        status, ms = timed_get(args.base + args.fast)
        fast_ms.append(ms)
        time.sleep(0.2)
    for t in threads:
        t.join()

    print(f"slow: {args.parallel} x race-analysis {args.year} R{args.round}")
    for status, ms in slow_results:
        print(f"  status {status}, {ms / 1000:.1f} s")
    if fast_ms:
        print(f"fast: {len(fast_ms)} calls to {args.fast} during the load")
        print(f"  median {statistics.median(fast_ms):.0f} ms, max {max(fast_ms):.0f} ms")
    else:
        print("fast: slow request finished before any fast call (load was probably cached)")


if __name__ == "__main__":
    main()
