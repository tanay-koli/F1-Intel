# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**CI** (`.github/workflows/ci.yml`, every push and PR): backend `ruff check`, `ruff format --check`, `pytest` (Python 3.13); frontend `npm ci && npm run build`.

**Backend tests and lint** (from `backend/`, after `venv/Scripts/python -m pip install -r requirements-dev.txt`):
```bash
venv/Scripts/python -m pytest                       # all tests (~1 s, no network)
venv/Scripts/python -m pytest tests/test_routes.py -k invalid   # one file / matching tests
venv/Scripts/ruff check .                           # lint (config in pyproject.toml, line length 100)
venv/Scripts/ruff format .                          # format
```
- **Tests never touch the network or FastF1.** `tests/conftest.py` blocks every non-loopback socket connect, makes `fastf1.get_session` raise (mock `get_full_race_analysis` or the telemetry function instead), and points the Jolpica cache and the precomputed store at temp files.
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
npm run dev      # http://localhost:5173, proxies /api -> $API_TARGET (default http://127.0.0.1:8000)
npm run build
```

**Both servers at once:**
- **Windows:** `powershell -ExecutionPolicy Bypass -File .\start.ps1`. It creates the venv if missing, installs requirements and starts both servers. Ctrl+C kills both process trees.
- **Linux/macOS:** `./start.sh`.
- **Docker:** `docker compose up --build`. The Jolpica and FastF1 caches live in the named volume `f1_cache`, and the frontend container proxies `/api` to `http://backend:8000`. The Docker files have not been run-tested, because Docker wasn't available where they were written.

**Configuration (`backend/settings.py`, pydantic-settings):** environment variables, or `backend/.env` (copy `backend/.env.example`; `.env` is git-ignored):

| Variable | Purpose |
|---|---|
| `CORS_ORIGINS` | Comma-separated allowed origins. Default: localhost and 127.0.0.1 on ports 5173 and 3000 |
| `DEFAULT_SEASON` | Season used when a request names none. Default: the current year. Validated at startup like the `season` param |
| `CACHE_DIR` | Holds `api_cache.sqlite` and FastF1's cache. Default: `backend/f1_cache` |
| `LOG_LEVEL` | Default: INFO |
| `PRECOMPUTE_ENABLED` | Run the precompute scheduler in this API process. Default: true |
| `PRECOMPUTE_DELAY_HOURS` | Hours after a race's start to precompute it. Default: 5 |
| `API_URL` | Where the precompute CLI finds the running API. Default: `http://127.0.0.1:8000` |
| `TELEMETRY_SEASONS` | Seasons FastF1 can load. Others get an immediate 503 without a load. Default: `2021,2022`; empty = always try |

Import `from settings import settings`; don't read `os.environ` directly.

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

1. **`ergast.py`** — wraps the **Jolpica** Ergast-compatible API (`https://api.jolpi.ca/ergast/f1`; the original ergast.com is dead even though docstrings/README still say "Ergast"). Every request goes through `_get()`, which caches raw JSON in SQLite at `$CACHE_DIR/api_cache.sqlite`. Functions reshape Ergast's nested `MRData` into flat dicts and attach team colors from `TEAM_COLORS`. `/api/cache/stats` and `DELETE /api/cache/clear` (`?expired_only=true` uses the same rules) manage this cache. Cache-clear and `POST /api/admin/precompute` are local-only (`main._require_local`): loopback client **and** no `Origin` header, so a browser page can't trigger them. In Docker, call them via `docker compose exec backend …`.
   - **Cache freshness is decided from the data** (`cache_policy.ttl_for`, called by `ergast.is_fresh` when a cached entry is read):

     | Data | Lifetime |
     |---|---|
     | Past seasons | Never expire |
     | A current-season round whose race started more than 6 h ago (`RESULTS_SETTLE`) and whose response has data | Never expires |
     | That round while the response is still empty | Retried hourly |
     | That round, and all season-level data (standings, schedule, `last`/`next`, driver season results), from the first session until race start + 6 h | 5 min |
     | Everything else | 1 h |

   - The policy reads the season's schedule from the cache itself, not through `_get`, to avoid recursion. With no cached schedule it falls back to 1 h.
   - Because lifetime is evaluated at read time, a stored `last`/`next` response re-expires as the season moves on.
2. **`telemetry.py`** — FastF1 session loading (cache in `$CACHE_DIR`, enabled at import time). First load of a session can take a minute+, which is why `api.js` uses a separate `telemetryApi` client with a 120s timeout. Data is downsampled (`_resample`) before returning.
   - **Timing data is only reachable for 2021 and 2022.** FastF1 fetches post-session data from `livetiming.formula1.com/static/...`, which now returns **401 for every season** (checked 2018 to 2025, from CloudFront, regardless of user agent). On any error ≥400, FastF1 3.8 retries `livetiming-mirror.fastf1.dev`, which only hosts 2021–2022. For other seasons FastF1 loads no laps or telemetry and builds the driver list from Jolpica, so the lap/telemetry routes fail with "data … has not been loaded yet". **An F1 TV login does not help:** FastF1 never sends the token on these requests; only its live-timing client (`fastf1.livetiming`) uses it. Use **2022 round 16 (Monza)** when you need telemetry that actually loads (the smoke check does). `settings.telemetry_seasons` encodes this, so requests for other seasons fail at once in `_fastf1_errors`; if F1 reopens access, change the setting, not the code.
   - Sessions load with `messages=True`, so `raceEvents` comes from race control. `classify_race_event` only counts deployments ("SAFETY CAR DEPLOYED", "VIRTUAL SAFETY CAR DEPLOYED", a message starting "RED FLAG"). "SAFETY CAR IN THIS LAP", stewards' "SAFETY CAR INFRINGEMENT" notes and "CHEQUERED FLAG" (which contains "RED FLAG") are not.
   - FastF1 leaves `TeamColor` empty when it falls back to Jolpica; `telemetry._driver_team_color()` then uses `ergast.TEAM_COLORS` by `TeamId` (equal to the Jolpica constructorId).
   - FastF1 has its own process-wide limit of **500 outgoing calls per hour** (`"any API: 500 calls/h"`). Failed loads burn through it fast, because they fall back to Jolpica, sometimes once per lap. Restarting the server resets the counter.

**`race_analyst.py`** is a deterministic, rule-based (no LLM, no network) per-lap commentary generator. It consumes the output of `telemetry.get_full_race_analysis()` and emits `{headline, key_battles, strategy_watch, lap_mover}` per lap; tune behavior via the threshold constants at the top.

`get_next_race()` (`/api/next-race`) reads Jolpica's `/<season>/next.json`, which for a finished season returns the *following* season's round 1. It returns `race: null` when the seasons don't match; the frontend treats that as "season complete". `/api/circuit-outline` serves the `ingest_fastf1.py` exports (404 when none exist). None are exported yet, and the export can only succeed for 2021–2022, the seasons FastF1 can load.

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
- Route defaults: `season` = `settings.default_season`, `round` = `"last"`, telemetry `year` = the default season's year. `ergast.py` functions have no season default; callers must pass one.

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
- `frontend/src/api.js` copies `message` onto the axios error, so pages that render `error.message` show the API's sentence. Prefer `<ErrorMsg error={error} context="…" />` (in `components/ui.jsx`): it shows a 503 as a neutral "Not available yet" notice rather than the red error box.
- Log level comes from `settings.log_level` (env `LOG_LEVEL`, default INFO).

**`uvicorn --reload` gets stuck on this machine.** After an edit it logs "Reloading…", but the old worker keeps serving stale code. If a change seems to have no effect, kill all `uvicorn`/`multiprocessing-fork` python processes and restart.

### Precomputed race analysis (`precomputed.py`, `jobs/`)
`/api/telemetry/race-analysis` and `/api/race-analyst` go through `services/race.py`:
- They read the precomputed store first, which takes milliseconds.
- If a race isn't stored, they compute it live through FastF1 (about 2 s warm, 20 s+ cold), returning identical JSON.
- The race analyst can also be built from a stored analysis alone.

**Storage:** the store is `$CACHE_DIR/precomputed.duckdb`, table `race_payloads(season, round, kind, payload JSON, computed_at, fastf1_version)`. `kind` is `race_analysis` or `race_analyst`, and each row holds a route's full response.
- It's a plain table rather than a dbt model, because these are finished API payloads, not transforms.
- It's a separate file from `warehouse/db/f1.duckdb`, so dbt never contends for the lock.

**Single writer (verified):** while one process has a DuckDB file open read-write, no other process can open it at all, not even read-only.
- The API process owns the file through one lazily opened connection behind a lock (`precomputed.Store`).
- `read_or_none` returns None on lock errors, so the route falls back to the live path.
- **Scheduler (`jobs/scheduler.py`):** APScheduler runs inside the API, started from `main.py`'s lifespan when `PRECOMPUTE_ENABLED` is set. It plans one job per race of the default season at race start + `PRECOMPUTE_DELAY_HOURS` (default 5), re-plans daily, and catches up a run missed within the last day. There is deliberately **no full-season backfill**: most seasons have no reachable timing data, and every failed load spends FastF1's 500 calls/h. With several uvicorn workers, enable it in only one.
- **CLI (from `backend/`):**
  ```bash
  venv/Scripts/python -m jobs.precompute --season 2022 --round 16
  ```
  It computes first, then opens the store only to write. If the running API holds the file, it POSTs to `/api/admin/precompute` (accepted only from loopback; `--api` / `API_URL` sets the URL), and the API recomputes from FastF1's now-warm disk cache. In Docker, run it with `docker compose exec backend python -m jobs.precompute …`.
- The store is not invalidated automatically. To rebuild a race (e.g. after changing the analyst), re-run the CLI for it.

### Warehouse (separate, offline pipeline)
`backend/warehouse/` is a batch analytics layer: `ingest_jolpica.py` loads `raw_*` tables (schedule, results, qualifying, pitstops, driver_standings) into DuckDB, then dbt builds `staging` (views) → `intermediate` → `marts` (tables). Staging models select from `raw_*` tables directly (no dbt `source()` definitions). `backend/analytics/*.py` query those marts read-only, but **are not wired into `main.py`**. They build all-time career profiles, which no route serves (the existing profiles are single-season, from Jolpica), and the warehouse DB only exists after the ingest and dbt steps have been run. The live API uses only Jolpica and FastF1.

### Frontend
- **Routing:** React Router (`BrowserRouter` in `main.jsx`, routes in `App.jsx`): `/` Home, `/results`, `/pit-stops`, `/h2h`, `/telemetry`, `/standings/drivers`, `/standings/constructors`, `/standings/progression` (`StandingsChartPage`, points-through-the-season chart; `?view=constructors` opens that tab), `/calendar`. Only Home + the four analysis pages are in the nav (`components/SiteHeader.jsx`); standings, the progression chart and the calendar are reached from Home.
- **Season lives in the URL** (`?season=2026`, omitted for the current year). `hooks/useSeason.js` reads/sets it; `App` passes `season` as a prop to every page. Build internal links with `withSeason(path, season, extra)` so the season carries over. `?round=N` deep-links `ResultsPage` and `TelemetryPage`; Telemetry then auto-runs that race's analysis. `TelemetryPage` is keyed by season so its local state resets on season change.
- **Home** (`pages/HomePage.jsx` + `pages/home/*`): next-race hero (countdown via `weekend.js#countdownTarget`, local-time weekend schedule, title-fight line from `lib/titleMath.js` using 25/GP + 8/sprint), last-race podium + final-lap race-analyst headline (hidden on any failure, since it 500s without FastF1 auth), top-6 drivers/constructors, remaining-rounds strip. Each panel handles its own loading skeleton / one-line error. Home uses the same query keys as the other pages (`['schedule', season]`, `['driver-standings', season]`, …) so caches are shared; keep them in sync.
- Data fetching uses TanStack Query (`main.jsx` sets 5-min `staleTime`, 2 retries); all endpoints are declared in `f1Api` in `api.js`, so add new ones there.
- **Styling:** new components use CSS Modules (`*.module.css`) and media queries. Older pages still use inline `style={{...}}` + `useIsMobile` from `components/ui.jsx`; leave them unless restyling them is the task. Charts use Recharts.
- **Design tokens** (`index.css :root`, used by old and new code alike): `--bg`, `--bg-card`, `--bg-elevated` (raised card), `--border`, `--border-strong`, `--pill-active`, `--text`, `--text-muted` (≥4.5:1 on every card colour, so dim things with colour rather than `opacity`). `--accent` (#FFC940) is only for "next" states and the focus ring; `--red` only for heading bars and the logo badge. Fonts: `--display` (Bebas Neue) for headings, names, numbers; `--body` is Archivo (variable `wdth` axis; the hero name and countdown use `font-stretch: 70–75%`, weight 800). `tabular-nums` is global. Team colours always come from the API (`teamColor` / `color` from backend `TEAM_COLORS`), never hardcoded in React.
- `components/SectionHeading.jsx` reproduces the display-font heading with the red bar and the outlined "Round N" badge. Reuse it for new sections.
- `components/F1Image.jsx` loads `/images/drivers/<driverId>.{webp,png,jpg,jpeg}` and `/images/constructors/<constructorId>.*`, trying extensions in order before falling back to a placeholder. Pass `alt` (the person or team name); it defaults to the id. The image `src` is state seeded from the id, so give each instance a `key` of the id when lists can reorder. Filenames must equal the Jolpica `driverId`/`constructorId`, using underscores. Driver IDs are often the bare surname (`norris`) but not always (`max_verstappen`, `arvid_lindblad`); the READMEs in `public/images/` list the 2026 IDs.
- CORS origins come from `settings.cors_origins`. In dev, the browser calls the API through Vite's same-origin proxy, so CORS only matters for direct calls.
