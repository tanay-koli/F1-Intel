---
version: 1
slug: "frontend-src-app-jsx"
primary_target: "frontend/src/App.jsx"
related_targets: []
---

Scope: the whole Pit Wall frontend (Home = bold; Results, H2H, Telemetry, standings, calendar, progression = Operate, dense tools).
Audience/job: F1 fans around race weekends; reviewers judging data honesty. Constraints: 44px targets, ≥4.5:1 text, amber focus ring, reduced motion, no h-scroll at 390px, calm 503s, team colours only from the API, no official F1 marks, no driver photos.

## Direction contract

THESIS: A race-programme wall: red is the frame, black is the data ground. Refuses the grey-card dashboard where every panel is the same tile; standings read as livery bands and outlined giant numbers, not avatar lists.

OWN-WORLD: Near-black ground (#0A0A0B) and dark-grey data cards; deep maroon-to-red bands for header, footer and page-title frames; Bebas Neue condensed caps at poster scale; oversized outlined position numerals; pill filter chips; dark tables inside rounded cards; team colour as full bands only on the top three, as 3px edges elsewhere. Amber only for next + focus.

STORY: The fan sees what's next and how long until lights out, who leads and by how much, then digs into a race in tools that scan like timing sheets.

FIRST VIEWPORT: Maroon header band with PIT WALL wordmark and pill nav; Home hero: next GP name huge in condensed caps, countdown digits at poster scale beside the circuit outline (or the outlined round number when no outline exists), weekend schedule as a dark table at right; a marquee band of the GP name below; stat tiles (title math, gap, races left) under it.

FORM: brief-pinned (user inspiration set: overall/constructors/analytics/home), position 1 of 1. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
