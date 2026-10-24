# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, both confirmed:

- **Engaged F1 fans** who open it around race weekends: checking the next race and its countdown, the title fight, the last race's result, and digging into how a race unfolded.
- **Reviewers of the author's work** (recruiters, engineers) who see it as a portfolio piece showing full-stack and data-engineering skill. They judge both the product and how well it handles real, imperfect data.

## Product Purpose

F1 Dashboard brings season context, results, and race analysis together in one place, from 1950 to the current season. Success means a fan can answer "what's happening this season and why did that race go the way it did" without leaving the app. It also means a reviewer comes away convinced the data is real, correct, and handled honestly at its edges.

## Positioning

What sets it apart from the official F1 app and timing sites:

- **Race analyst commentary**: a deterministic, rule-based, lap-by-lap story of each race (headline, key battles, strategy watch, lap mover). No LLM involved.
- **Telemetry and head-to-head**: speed traces, lap positions, and driver *and* constructor head-to-heads.
- **Season context**: title math (what's still mathematically possible), points progression through the season, and history back to 1950.

## Operating Context

- Used most around race weekends. Home shows the next race, a local-time weekend schedule, the last race, top standings, and the remaining rounds.
- The season lives in the URL (`?season=`), so any view of any season can be shared as a link.
- Analysis pages (Results, Head-to-Head, Telemetry) are for digging in. Standings, the progression chart, and the calendar are reached from Home.

## Capabilities and Constraints

- Data sources: Jolpica (Ergast-compatible) for results, standings and schedule; FastF1 for 2021–2022 timing; OpenF1 for 2023 onward.
- **Telemetry gaps are permanent facts, not bugs:** 2018–2020 and other pre-2023 seasons have no reachable timing data. Lap/telemetry views for those seasons must say "not available" plainly instead of showing an error.
- Race analyst battle and undercut lines only appear for 2023+ (they need interval data).
- A cold telemetry load can take 20 s to over a minute. Precomputed races load in milliseconds.
- Recent races may not be published by OpenF1 yet; the UI treats that as "not available yet".
- Team colours always come from the API, never hardcoded in the frontend.
- Driver and constructor images are optional local files keyed by Jolpica ID, with a placeholder fallback.
- Terminology follows F1 conventions: round, GP, sprint, constructor, grid, stint, undercut, safety car / VSC / red flag.

## Brand Commitments

- Name: **F1 Dashboard**.
- An unofficial fan project. It must not imitate official Formula 1 branding or present itself as an official product.

## Evidence on Hand

- Real data from live APIs; nothing is mocked in the running app.
- No testimonials, user counts, press, or endorsements exist. Do not invent any.

## Product Principles

1. **Context over raw numbers.** Every stat should answer "so what": title math, gaps, movers, the race story.
2. **Honest about data limits.** Missing or unpublished data is shown as a calm, explained absence, never as a broken page or invented values.
3. **Race-weekend first.** What's next and what just happened is always one glance from Home.
4. **Shareable state.** Season and round live in the URL; every view can be linked.
5. **Correctness is the portfolio.** Accurate edge cases (unclassified finishers, excluded constructors, sprint points) matter as much as features.
