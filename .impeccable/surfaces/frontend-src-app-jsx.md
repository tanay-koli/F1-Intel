---
version: 1
slug: "frontend-src-app-jsx"
primary_target: "frontend/src/App.jsx"
related_targets: []
---

Scope: the whole Pit Wall frontend (Home = landing, its hero a chronograph; Results, H2H, Telemetry, standings, calendar, progression = Operate, dense tools).
Audience/job: F1 fans around race weekends; reviewers judging data honesty. Constraints: 44px targets, ≥4.5:1 text, signal-orange focus ring, reduced motion, no h-scroll at 390px, calm 503s, team colours only from the API, no official F1 marks, no driver photos.
User answers (2026-10-25): monochrome + one signal orange; chronograph dial hero; whole site. Inspiration pinned: theme.jpg (black HUD, condensed caps, one orange signal) for the analysis pages, base.jpg (quiet charcoal, white type) for the base.

## Direction contract

THESIS: A chronometer on a black pit wall: precision, not volume. Monochrome instrument faces where fine ticks, thin condensed type and one orange signal carry the weight. Refuses the poster-loud race programme it replaces (maroon bands, red edges, giant outlined numerals, scrolling marquee).

OWN-WORLD: Black ground (#09090A) and charcoal data cards (#111113 / #18181B) with hairlines; no red anywhere in the chrome. Barlow Condensed (300–500, uppercase) as the instrument voice for names, headings and figures; Archivo for text. One signal orange (#FF6B1A) only for "next", live, focus and the seconds hand. Small radii (6px cards). Team colour stays as data: bands on the top three, chips, bars and dots elsewhere.

STORY: The fan reads one instrument: how long until the next session, ticking; then what's next on the weekend, who leads, and digs into races in tools that scan like timing screens.

FIRST VIEWPORT: Black header with the PIT WALL wordmark and nav. Hero: left, the GP name in light condensed caps, round and circuit, and the weekend schedule as a quiet table; right, a large chronograph dial (≈440px): 60 ticks where the seconds still left in the minute stay lit, a sweeping orange seconds hand, a minute-register arc draining through the hour, days/hours/minutes as thin digits in the face. Stat tiles below.

SIGNATURE: the dial's tick ring, unrolled into tick-scale rules under figures on the analysis pages (title gap track, race analyst lap scale). Motion: on load the ticks draw in around the ring and the hand extends; then a continuous smooth sweep (stepped once a second under reduced motion).

FORM: brief-pinned (user inspiration: theme.jpg + base.jpg), position 1 of 1. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
