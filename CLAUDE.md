# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Backend tests and lint** (from `backend/`, after `venv/Scripts/python -m pip install -r requirements-dev.txt`):
```bash
venv/Scripts/python -m pytest                       # all tests (~1 s, no network)
venv/Scripts/python -m pytest tests/test_routes.py -k invalid   # one file / matching tests
venv/Scripts/ruff check .                           # lint (config in pyproject.toml, line length 100)
venv/Scripts/ruff format .                          # format
```
- **Tests never touch the network.** `tests/conftest.py` blocks every non-loopback socket connect and points the Jolpica cache at a temp file.
- The `jolpica` fixture replays recorded responses by patching `ergast._get`. The recordings are in `tests/fixtures/jolpica/`, with `manifest.json` mapping URL → file.
- `scripts/record_fixtures.py` (uses the network) re-records them, along with the 2022 Monza race analysis and the race-analyst snapshot. Re-run it when you add a call the tests need, or change the analyst on purpose; then review the fixture diff.
- `test_race_analyst.py` has a snapshot test plus one test per threshold constant, each asserting both sides of the boundary.
- The frontend has no tests or linter.

**Backend** (FastAPI, run from `backend/`). Use **Python 3.12 or 3.13**: on the newest Python release, compiled deps (pandas, pyarrow, duckdb) may lack prebuilt wheels and fail to build from source. On Windows pick the version with the `py` launcher:
```bash
py -3.13 -m venv venv
venv/Scripts/python -m pip install -r requirements.txt     # Linux/macOS: venv/bin/python
venv/Scripts/python -m uvicorn main:app --reload --port 8000   # Swagger UI at http://localhost:8000/docs
```
`fastf1` pins `pandas<3`, so keep pandas on 2.x when bumping requirements.

Regression check against a running backend (calls every route, diffs status and JSON shape against the saved baseline; exits 1 on a regression):
```bash
venv/Scripts/python scripts/smoke_check.py --compare scripts/baseline.json
```
Use `127.0.0.1`, not `localhost`, for local calls: uvicorn listens on IPv4 only, and `localhost` tries IPv6 first (+~2 s per request on Windows).

**Frontend** (Vite + React, run from `frontend/`):
```bash
npm install
npm run dev      # http://localhost:5173, proxies /api -> localhost:8000
npm run build
```

`./start.sh` starts both servers together on Linux/macOS only (it uses `python3` and `venv/bin/activate`); on Windows start the two servers separately.

**Smoke-checking the UI** (no Playwright installed). Headless Edge's `--window-size` never goes below ~492px wide, so a "390px" `--screenshot` is just a crop of a wider layout. Use the CDP script instead, which emulates the exact viewport and prints `scrollWidth` (should equal the width, i.e. no horizontal scroll):
```bash
cd frontend
node scripts/screenshot.mjs http://localhost:5173/ desktop.png 1400 1000
node scripts/screenshot.mjs http://localhost:5173/ mobile.png 390 844 full   # `full` = whole page
```
Set `EDGE_PATH` to use another Chromium-based browser.

**Warehouse** (DuckDB + dbt, optional, not used by the running API):
```bash
cd backend/warehouse/ingest && python ingest_jolpica.py --seasons 2024-2025   # writes backend/warehouse/db/f1.duckdb
cd backend/warehouse/dbt_f1 && dbt run --profiles-dir .                        # profiles.yml lives in the project dir
cd backend && python check_db.py                                               # summarise warehouse tables
```
`ingest_fastf1.py --year 2024 [--gp "Monaco"]` exports fastest-qualifying-lap X/Y coords to `warehouse/raw/circuits/*.json`.

## Architecture

### Data flow
React page → `frontend/src/api.js` (axios, base `/api`) → Vite dev proxy → FastAPI `backend/main.py` → one of two data sources:

1. **`ergast.py`** — wraps the **Jolpica** Ergast-compatible API (`https://api.jolpi.ca/ergast/f1`; the original ergast.com is dead even though docstrings/README still say "Ergast"). Every request goes through `_get()`, which caches raw JSON in SQLite at `backend/f1_cache/api_cache.sqlite` with a TTL chosen by URL keyword (`_LIVE_KEYWORDS` → 1h, everything else → 24h). Functions reshape Ergast's nested `MRData` into flat dicts and attach team colors from `TEAM_COLORS`. `/api/cache/stats` and `DELETE /api/cache/clear` manage this cache.
2. **`telemetry.py`** — FastF1 session loading (cache in `backend/f1_cache/`, enabled at import time). First load of a session can take a minute+, which is why `api.js` uses a separate `telemetryApi` client with a 120s timeout. Data is downsampled (`_resample`) before returning.
   - **Timing data is only reachable for 2021 and 2022.** FastF1 fetches post-session data from `livetiming.formula1.com/static/...`, which now returns **401 for every season** (checked 2018 to 2025, from CloudFront, regardless of user agent). On any error ≥400, FastF1 3.8 retries `livetiming-mirror.fastf1.dev`, which only hosts 2021–2022. For other seasons FastF1 loads no laps or telemetry and builds the driver list from Jolpica, so the lap/telemetry routes fail with "data … has not been loaded yet". **An F1 TV login does not help:** FastF1 never sends the token on these requests; only its live-timing client (`fastf1.livetiming`) uses it. Use **2022 round 16 (Monza)** when you need telemetry that actually loads (the smoke check does).
   - FastF1 leaves `TeamColor` empty when it falls back to Jolpica; `telemetry._driver_team_color()` then uses `ergast.TEAM_COLORS` by `TeamId` (equal to the Jolpica constructorId).
   - FastF1 has its own process-wide limit of **500 outgoing calls per hour** (`"any API: 500 calls/h"`). Failed loads burn through it fast, because they fall back to Jolpica, sometimes once per lap. Restarting the server resets the counter.

**`race_analyst.py`** is a deterministic, rule-based (no LLM, no network) per-lap commentary generator. It consumes the output of `telemetry.get_full_race_analysis()` and emits `{headline, key_battles, strategy_watch, lap_mover}` per lap; tune behavior via the threshold constants at the top.

`get_next_race()` (`/api/next-race`) reads Jolpica's `/<season>/next.json`, which for a finished season returns the *following* season's round 1. It returns `race: null` when the seasons don't match; the frontend treats that as "season complete". `/api/circuit-outline` serves the `ingest_fastf1.py` exports (404 when none exist; there are none until FastF1 is authenticated).

**Route layout (`main.py`):** each route parses typed params, makes one call (to `ergast.py`, `telemetry.py` or `services/`) and returns. Logic that needs several data calls lives in `services/` (`h2h.py`, `profiles.py`, `race.py`, `circuits.py`, `cache.py`). Register routes with the `route(path, Model)` helper, so every route has a response model.
- **Params (`params.py`):**
  - `Season`: 1950 to next year, or `"current"`.
  - `Round`: a positive int, `"last"` or `"next"`.
  - Both stay strings, because they're spliced into Jolpica URLs.
  - Telemetry routes take `year` (2018 to next year), not `season`, plus `TelemetryRound` and the `SessionType` literal. Driver params are free-form: the Telemetry page sends FastF1 car numbers like `"1"`.
  - Invalid values return a 422 in the error shape below.
- **Response models (`schemas.py`)** describe the JSON exactly as the builders produce it, and routes use `response_model_exclude_unset=True`:
  - `field: X = None` means some code paths omit the key. For example, results for a round with no data return only `{season, round, results: []}`.
  - `X | None` with no default means the key is always present but can be null.
  - `Number` (`int | float`) stops a computed `0` from becoming `0.0`.
  - When you change a builder's output, change its model in the same commit. Keys missing from the model are silently dropped, and the smoke check flags it as a shape change.
- Unclassified entries use position `99` everywhere: race results, and standings entries excluded from a championship, which have no position in Jolpica (e.g. Tyrrell 1985, McLaren 2007).
- Defaults are still `season="2026"` and `round="last"`.

**Errors:** routes have no try/except. Data code raises the exceptions in `errors.py`, and `main.py`'s handlers turn them into `{"error": <code>, "message": <sentence shown to the user>}`:

| Exception | Status | Raised when |
|---|---|---|
| `NotFound` | 404 | Jolpica 404s, or an unknown driver/constructor/circuit/round |
| `InvalidInput` | 422 | Bad parameters; FastAPI validation errors use the same shape |
| `UpstreamError` | 502 | Jolpica is unreachable or sends malformed data |
| `DataNotAvailable` | 503 | FastF1 has no lap or telemetry data |
| `RateLimited` | 503 | Jolpica 429, or FastF1's 500 calls/h limit |

- `ergast._get()` classifies Jolpica failures at the source.
- `telemetry._fastf1_errors` maps FastF1 exceptions for the public functions.
- Anything else becomes a 500 with a logged traceback.
- Only catch `NotFound` when "no data" is a legitimate answer. A broad `except Exception` would silently drop rate-limited rounds.
- `frontend/src/api.js` copies `message` onto the axios error, so pages that render `error.message` show the API's sentence.
- Log level comes from the `LOG_LEVEL` env var (default INFO).

**`uvicorn --reload` gets stuck on this machine.** After an edit it logs "Reloading…", but the old worker keeps serving stale code. If a change seems to have no effect, kill all `uvicorn`/`multiprocessing-fork` python processes and restart.

### Warehouse (separate, offline pipeline)
`backend/warehouse/` is a batch analytics layer: `ingest_jolpica.py` loads `raw_*` tables (schedule, results, qualifying, pitstops, driver_standings) into DuckDB, then dbt builds `staging` (views) → `intermediate` → `marts` (tables). Staging models select from `raw_*` tables directly (no dbt `source()` definitions). `backend/analytics/*.py` query those marts read-only, but **are not yet wired into `main.py`** — the live API uses only Jolpica + FastF1.

### Frontend
- **Routing:** React Router (`BrowserRouter` in `main.jsx`, routes in `App.jsx`): `/` Home, `/results`, `/pit-stops`, `/h2h`, `/telemetry`, `/standings/drivers`, `/standings/constructors`, `/calendar`. Only Home + the four analysis pages are in the nav (`components/SiteHeader.jsx`); standings and calendar are reached from Home. `StandingsChartPage.jsx` and `TracksPage.jsx` exist but aren't routed.
- **Season lives in the URL** (`?season=2026`, omitted for the current year). `hooks/useSeason.js` reads/sets it; `App` passes `season` as a prop to every page. Build internal links with `withSeason(path, season, extra)` so the season carries over. `?round=N` deep-links `ResultsPage` and `TelemetryPage`; Telemetry then auto-runs that race's analysis. `TelemetryPage` is keyed by season so its local state resets on season change.
- **Home** (`pages/HomePage.jsx` + `pages/home/*`): next-race hero (countdown via `weekend.js#countdownTarget`, local-time weekend schedule, title-fight line from `lib/titleMath.js` using 25/GP + 8/sprint), last-race podium + final-lap race-analyst headline (hidden on any failure, since it 500s without FastF1 auth), top-6 drivers/constructors, remaining-rounds strip. Each panel handles its own loading skeleton / one-line error. Home uses the same query keys as the other pages (`['schedule', season]`, `['driver-standings', season]`, …) so caches are shared; keep them in sync.
- Data fetching uses TanStack Query (`main.jsx` sets 5-min `staleTime`, 2 retries); all endpoints are declared in `f1Api` in `api.js`, so add new ones there.
- **Styling:** new components use CSS Modules (`*.module.css`) and media queries. Older pages still use inline `style={{...}}` + `useIsMobile` from `components/ui.jsx`; leave them unless restyling them is the task. Charts use Recharts.
- **Design tokens** (`index.css :root`, used by old and new code alike): `--bg`, `--bg-card`, `--bg-elevated` (raised card), `--border`, `--border-strong`, `--pill-active`, `--text`, `--text-muted` (≥4.5:1 on every card colour, so dim things with colour rather than `opacity`). `--accent` (#FFC940) is only for "next" states and the focus ring; `--red` only for heading bars and the logo badge. Fonts: `--display` (Bebas Neue) for headings, names, numbers; `--body` is Archivo (variable `wdth` axis; the hero name and countdown use `font-stretch: 70–75%`, weight 800). `tabular-nums` is global. Team colours always come from the API (`teamColor` / `color` from backend `TEAM_COLORS`), never hardcoded in React.
- `components/SectionHeading.jsx` reproduces the display-font heading with the red bar and the outlined "Round N" badge. Reuse it for new sections.
- `components/F1Image.jsx` loads `/images/drivers/<driverId>.{webp,png,jpg,jpeg}` and `/images/constructors/<constructorId>.*`, trying extensions in order before falling back to a placeholder. Pass `alt` (the person or team name); it defaults to the id. The image `src` is state seeded from the id, so give each instance a `key` of the id when lists can reorder. Filenames must equal the Jolpica `driverId`/`constructorId` (e.g. `norris`, `max_verstappen`, `red_bull`) — the example table in `public/images/drivers/README.md` is out of date.
- CORS in `main.py` only allows `localhost:5173` and `localhost:3000`.
