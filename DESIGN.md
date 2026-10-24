---
name: Pit Wall
description: Season context, results and race analysis for F1, from 1950 to now.
colors:
  asphalt: "#141519"
  graphite-card: "#1A1C21"
  graphite-raised: "#1E2025"
  pit-lane-grey: "#262A31"
  hairline: "#2A2D34"
  hairline-strong: "#343842"
  start-light-red: "#E10600"
  start-light-red-dim: "#991004"
  safety-amber: "#FFC940"
  amber-ink: "#14130D"
  grid-white: "#E8EBEF"
  telemetry-grey: "#A3ABB6"
  telemetry-grey-dim: "#8A919C"
typography:
  display:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.06em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(36px, 5vw, 60px)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 75"
  title:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.04em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "'tnum'"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  xs: "4px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  card:
    backgroundColor: "{colors.graphite-card}"
    textColor: "{colors.grid-white}"
    rounded: "{rounded.lg}"
    padding: "24px"
  ranked-row:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.grid-white}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  ranked-row-selected:
    backgroundColor: "{colors.pit-lane-grey}"
  nav-pill:
    textColor: "{colors.telemetry-grey}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  nav-pill-active:
    backgroundColor: "{colors.pit-lane-grey}"
    textColor: "{colors.grid-white}"
  button-secondary:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.grid-white}"
    rounded: "{rounded.md}"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.pit-lane-grey}"
  tab:
    textColor: "{colors.telemetry-grey}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "36px"
  tab-active:
    backgroundColor: "{colors.pit-lane-grey}"
    textColor: "{colors.grid-white}"
  badge-next:
    backgroundColor: "{colors.safety-amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  select:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.grid-white}"
    rounded: "{rounded.sm}"
    height: "44px"
---

# Design System: Pit Wall

## Overview

**Creative North Star: "The Pit Wall"**

The strategists' wall of timing screens: dark, dense, and calm under pressure. Everything sits in near-black graphite layers so the information carries the colour: a team's livery on the edge of its row, amber on whatever comes next, red only to sign the page. Numbers are set big in a condensed display face and read first; prose is short and secondary.

Components are precise and quiet. Surfaces are flat, borders are hairlines, and hover is a small shift in tone, not a lift. The display face (Bebas Neue) gives the race-poster energy; Archivo, squeezed on its width axis for the hero race name and countdown, adds speed without decoration. Density follows the job: Home's hero breathes, while the standings, results and telemetry views pack rows tightly for scanning.

**Key Characteristics:**
- Near-black tonal layering instead of shadows.
- Team colour as a 3px edge (left on rows, top on cards and podium steps), always from the API.
- Condensed display type for positions, names, points and countdown digits; tabular numerals everywhere.
- One amber accent for "next" states and the focus ring; red only for heading bars and the logo badge.
- 44px minimum hit targets on every control.

## Colors

A near-monochrome graphite palette where colour is earned by meaning: team identity, "what's next", or the brand mark.

### Primary
- **Start-Light Red** (#E10600): the brand signal. Heading bars on section titles, the logo badge, the range-slider thumb on the race analyst. A faint wash of it tints the top of the page background.
- **Start-Light Red Dim** (#991004): scrollbar thumb on hover; nowhere else.

### Secondary
- **Safety Amber** (#FFC940): "next" only: the next session in the weekend schedule, the next round in the season strip, the `Next` badge, and the global focus ring.
- **Amber Ink** (#14130D): text on Safety Amber fills.

### Neutral
- **Asphalt** (#141519): the page background, under a faint 45° carbon-weave texture.
- **Graphite Card** (#1A1C21): cards and panels.
- **Graphite Raised** (#1E2025): rows, podium cards, buttons, inputs: anything sitting on a card.
- **Pit-Lane Grey** (#262A31): selected rows, active nav pills and tabs, button hover.
- **Hairline** (#2A2D34) and **Hairline Strong** (#343842): borders and dividers; Strong for hover borders and inputs.
- **Grid White** (#E8EBEF): primary text.
- **Telemetry Grey** (#A3ABB6): secondary text, labels, units. At least 4.5:1 on every surface colour.
- **Telemetry Grey Dim** (#8A919C): the quietest text that still clears 4.5:1 on cards.

### Named Rules
**The Livery Rule.** Team colour is data, never decoration. It comes from the API (`teamColor` / `color`), is never hardcoded in the frontend, and appears as a 3px edge or a fill tied to that team's own row, card or chart series.

**The One Next Rule.** Safety Amber marks exactly one thing per view as "next" (plus the focus ring). If two things are amber, one of them is wrong.

**The Dim-by-Colour Rule.** De-emphasise with Telemetry Grey, not `opacity`, so dimmed text keeps its contrast.

## Typography

**Display Font:** Bebas Neue (with sans-serif)
**Body Font:** Archivo, variable width axis (with system-ui, sans-serif)

**Character:** Bebas Neue is the race-poster voice for anything you'd read off a timing tower: positions, names, points, headings. Archivo does the explaining, and stretches down to 70–75% width at weight 800 when a number or race name has to hit hard.

### Hierarchy
- **Display** (Bebas Neue 400, 26px, line-height 1, 0.06em, uppercase): section headings next to the red bar.
- **Headline** (Archivo 800 at 75% width, clamp(36px, 5vw, 60px), 0.95): the next race's name in the hero. Countdown digits use the same treatment at 70% width, clamp(48px, 7vw, 76px).
- **Title** (Bebas Neue 400, 18–28px, line-height 1, 0.04em): driver and team names (18–22px), points and stat values (22–28px), position numbers (22–26px).
- **Body** (Archivo 400, 14px, 1.6): default text; context lines cap at 56ch.
- **Label** (Archivo 600, 12–14px): eyebrows, panel labels, units and sub-lines (units and sub-lines at 400 in Telemetry Grey).

### Named Rules
**The Tabular Rule.** `tabular-nums` is global; numbers never jitter as they update.

**The Numbers-in-Display Rule.** A position, points total or countdown is set in the display face (Bebas Neue, or condensed Archivo 800). Its unit ("pts", "days") drops to body size in Telemetry Grey.

## Layout

Content sits in a centred 1200px column under a sticky 64px header. Spacing steps are 4 / 8 / 12 / 16 / 24 / 32px: 8–12px inside rows, 16px between panels, 24px card padding, 32px between page sections.

- **Home:** a two-part hero (race on the left, weekend schedule on the right, split by a hairline), then three panels, then the season strip of round cards.
- **Ranked pages (standings, results):** a list beside a 340px sticky detail panel.
- **Breakpoints:** at 1080px the Home panels go to 2 columns, and at 720px to one. At 900px the hero stacks, the ranked layout drops its side panel below the list, and the header nav wraps onto its own row. At 640px the podium becomes three rows in finishing order.
- No horizontal scroll at 390px.

## Elevation & Depth

Flat. Depth is tonal: Asphalt → Graphite Card → Graphite Raised → Pit-Lane Grey, each one step lighter, with hairline borders where layers meet. There are no box shadows on surfaces. The only blur is the sticky header (85% Asphalt, 12px backdrop blur), and the only glow is the race-analyst slider thumb.

**The Flat-Wall Rule.** Hover and selection change tone or border, never lift. If something needs to feel raised, move it one step up the tonal ladder.

## Shapes

Gently rounded, tighter as things get smaller: 14px on Home cards, 10px on buttons and round cards, 8px on rows, panels, inputs and tabs, 4px on badges and podium steps, full pill for nav pills and status badges. Borders are 1px hairlines; the only heavy stroke is the 3px team-colour edge. Podium steps have square bottoms and rounded tops, like a real podium.

## Components

### Buttons
- **Shape:** gently rounded (10px), 44px tall.
- **Secondary (default):** Graphite Raised fill, Hairline Strong border, Grid White 600 text; hover moves to Pit-Lane Grey.
- **Text link:** Telemetry Grey, underlined in Hairline Strong 4px below the text; hover turns both to Grid White.
- There is no filled primary button. Actions are rare and stay quiet.

### Chips and Badges
- **Next badge:** Safety Amber pill, Amber Ink text, 11px bold.
- **Done badge:** outlined pill, Hairline Strong border, Telemetry Grey text.
- **Round badge** (next to headings): Graphite Raised, hairline border, 4px radius, 12px Telemetry Grey.

### Cards and Containers
- **Corner Style:** 14px on Home, 8px for detail panels.
- **Background:** Graphite Card, 1px Hairline border.
- **Team-aware panels** carry a 3px top edge in the team colour (Hairline Strong when no team applies).
- **Internal Padding:** 24px (18px on phones); detail panels 20px.

### Inputs and Fields
- **Season select:** Graphite Raised, Hairline Strong border, 8px radius, 44px tall, custom grey chevron.
- **Focus:** the global 2px Safety Amber outline at a 2px offset.

### Navigation
- **Header:** sticky and blurred; a red display-font logo badge, then the wordmark in Telemetry Grey.
- **Nav pills:** 44px tall, Telemetry Grey 500. Hover gets a Graphite Raised fill; active gets Pit-Lane Grey with Grid White 600 text.
- **Mobile (≤900px):** brand and season on the first row, pills wrapping underneath.
- **Tabs** inside pages: 36px, 8px radius; the active tab uses `aria-pressed` and a Pit-Lane Grey fill.

### Ranked Row (signature)
The timing-tower row used for standings and results: position (display, Telemetry Grey) / image / name and a thin points bar in the team colour / value. Graphite Raised, 8px radius, with a 3px team-colour edge on the left. It's a button when it opens the detail panel; selected rows move to Pit-Lane Grey.

### Podium (signature)
Three cards in P2–P1–P3 order, P1 raised one step. Each card has a team-colour top edge, name and value in display type. On phones the cards fall into three rows in finishing order. On Home the compact version stands drivers on tonal steps of height 72/52/40px, with the position number in the team colour.

### Section Heading (signature)
A 4×24px red bar, a Display title in uppercase, an optional outlined Round badge, and a right-aligned text link.

### Weekend Schedule
Sessions as 44px rows: name / local time / badge. Finished sessions dim through colour and strike out their time. The next session gets Graphite Raised plus an amber-tinted border and the Next badge.

## Do's and Don'ts

### Do:
- **Do** take team colours from the API and use them as 3px edges, bars or chart series for that team's own data.
- **Do** set positions, points and countdowns in Bebas Neue or condensed Archivo 800, with units at 12px in Telemetry Grey.
- **Do** keep every interactive element at least 44px tall (tabs inside panels: 36px).
- **Do** show missing data as a calm notice in Telemetry Grey (`ErrorMsg`'s "Not available yet"), not a red error box.
- **Do** build new components as CSS Modules using the `:root` tokens.

### Don't:
- **Don't** use Start-Light Red for anything but heading bars, the logo badge and the analyst slider.
- **Don't** use Safety Amber for anything but "next" and focus.
- **Don't** dim with `opacity`; use Telemetry Grey.
- **Don't** add box shadows to surfaces; step up the tonal ladder instead.
- **Don't** hardcode a team colour in React.
- **Don't** use official Formula 1 logos, wordmarks or marks; the product is an unofficial fan project.
