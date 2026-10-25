---
name: Pit Wall
description: Season context, results and race analysis for F1, from 1950 to now.
colors:
  pit-black: "#09090A"
  instrument-card: "#111113"
  raised-graphite: "#18181B"
  dial-face: "#0D0D0F"
  hairline: "#232327"
  hairline-strong: "#34343A"
  pressed-graphite: "#2A2A30"
  signal-orange: "#FF6B1A"
  signal-ink: "#09090A"
  dial-white: "#EDEDEF"
  bezel-grey: "#A3A3AB"
  tick-grey: "#8A8A93"
  fault-red: "#E5484D"
  pit-board-yellow: "#F5B73B"
typography:
  display:
    fontFamily: "Barlow Condensed, Archivo, sans-serif"
    fontSize: "clamp(40px, 5.2vw, 72px)"
    fontWeight: 300
    lineHeight: 0.92
    letterSpacing: "0.01em"
  numeral:
    fontFamily: "Barlow Condensed, Archivo, sans-serif"
    fontSize: "clamp(64px, 8vw, 96px)"
    fontWeight: 300
    lineHeight: 1
  headline:
    fontFamily: "Barlow Condensed, Archivo, sans-serif"
    fontSize: "clamp(36px, 4.6vw, 52px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.02em"
  title:
    fontFamily: "Barlow Condensed, Archivo, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.04em"
  card-title:
    fontFamily: "Barlow Condensed, Archivo, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.04em"
  name:
    fontFamily: "Barlow Condensed, Archivo, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.02em"
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
  nav:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  hairline: "2px"
  inner: "4px"
  card: "6px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  site-header:
    backgroundColor: "{colors.pit-black}"
    textColor: "{colors.dial-white}"
    height: "68px"
  nav-pill:
    textColor: "{colors.bezel-grey}"
    typography: "{typography.nav}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "44px"
  nav-pill-active:
    backgroundColor: "{colors.pressed-graphite}"
    textColor: "{colors.dial-white}"
  card:
    backgroundColor: "{colors.instrument-card}"
    textColor: "{colors.dial-white}"
    rounded: "{rounded.card}"
    padding: "24px"
  button-primary:
    backgroundColor: "{colors.dial-white}"
    textColor: "{colors.pit-black}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "44px"
  button-primary-disabled:
    backgroundColor: "{colors.raised-graphite}"
    textColor: "{colors.tick-grey}"
  chip:
    textColor: "{colors.bezel-grey}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  chip-pressed:
    backgroundColor: "{colors.dial-white}"
    textColor: "{colors.pit-black}"
  select:
    backgroundColor: "{colors.raised-graphite}"
    textColor: "{colors.dial-white}"
    rounded: "{rounded.pill}"
    padding: "0 36px 0 16px"
    height: "44px"
  season-picker-panel:
    backgroundColor: "{colors.instrument-card}"
    rounded: "{rounded.card}"
    padding: "12px"
    width: "340px"
  table-row:
    textColor: "{colors.dial-white}"
    rounded: "8px"
    padding: "8px 12px 8px 4px"
    height: "60px"
  table-row-hover:
    backgroundColor: "{colors.raised-graphite}"
  table-row-selected:
    backgroundColor: "{colors.pressed-graphite}"
  stat-tile:
    backgroundColor: "{colors.instrument-card}"
    rounded: "{rounded.card}"
    padding: "18px 20px"
  stat-chip:
    backgroundColor: "{colors.raised-graphite}"
    rounded: "{rounded.inner}"
    padding: "14px 16px"
  badge-next:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.signal-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  notice:
    backgroundColor: "{colors.instrument-card}"
    textColor: "{colors.bezel-grey}"
    rounded: "{rounded.inner}"
    padding: "14px 18px"
---

# Design System: Pit Wall

## Overview

**Creative North Star: "The Black Chronometer"**

A precision instrument on a black pit wall. The interface is a set of monochrome instrument faces: charcoal cards on black, divided by hairlines, carrying thin condensed capitals and tabular figures. Weight comes from fine ticks and exact numbers, not from volume. One orange signal marks what is live or next, the way a chronograph has a single coloured seconds hand.

The Home hero is the literal instrument: a chronograph dial counting down to the next session, its ticks going dark as the minute runs out. The same tick ring is unrolled into straight scales under figures elsewhere (the title-gap track, the lap scale of the race analyst), so the whole product reads as one instrument family. The analysis pages are dense and quiet, and scan like a timing screen.

Team colour is data, not decoration. It arrives from the API and appears as a dark tint with a 2px edge on identity heads (the top three, head-to-head sides, profile and telemetry heads), and as share bars, chart lines and small dots everywhere else. There are no driver photos, no code chips and no constructor logos. Drivers and teams appear by name.

This world replaced a poster-loud "race programme" look (maroon bands, red frame edges, giant outlined numerals cropped by their bands, a scrolling marquee). None of that returns.

**Key Characteristics:**
- Black ground, charcoal cards, 1px hairlines, no shadows.
- Barlow Condensed in uppercase for headings, names and figures; Archivo for text.
- One signal orange, used only for "next", live, focus and the seconds hand.
- Tick scales borrowed from the chronograph dial, under figures and timelines.
- Team colour as tint plus edge on identity heads, as bars, lines and dots elsewhere.
- Small radii (6px cards, 4px inner panels) and full-pill controls at 44px.
- Names, never codes in boxes; numbers whole, never cropped.

## Colors

A monochrome instrument with one signal colour, and team colours that only ever come from the data.

### Primary
- **Signal Orange** (`signal-orange`): the one signal. The next session's ring and "Next" badge, the next round in the season strip and calendar, the chronograph seconds hand and its seconds readout, the loading spinner arc, the focus ring and text selection. Text on it is **Signal Ink** (`signal-ink`).

### Neutral
- **Pit Black** (`pit-black`): the page ground, the header and the footer. Also the text on white pills.
- **Instrument Card** (`instrument-card`): every card, table, tile, panel and notice that holds data.
- **Raised Graphite** (`raised-graphite`): one step up. Row hover, stat chips inside panels, selects, inputs, chart tooltips and tracks.
- **Pressed Graphite** (`pressed-graphite`): the selected row and the active nav pill.
- **Dial Face** (`dial-face`): the chronograph's face, a hair darker than a card so the dial reads as glass.
- **Hairline** (`hairline`) and **Hairline Strong** (`hairline-strong`): row dividers and card borders; Strong for chip, select and table-head borders, unlit ticks and chart axes.
- **Dial White** (`dial-white`): primary text, lit major ticks, the minute register, pressed chips and the primary button.
- **Bezel Grey** (`bezel-grey`): secondary text, labels, units, the stroke of outlined position numbers. At least 4.5:1 on every card colour.
- **Tick Grey** (`tick-grey`): the quietest text that still clears 4.5:1 (finished sessions, disabled controls), lit minor ticks, and the fallback colour for teams outside the colour table.

### Status
- **Fault Red** (`fault-red`): error states only, as the border of the error box. A missing or unpublished dataset is not an error and never uses it.

### Brand
- **Pit-Board Yellow** (`pit-board-yellow`): the logo mark only (the pit-board flag in the header and the favicon). It never appears in UI.

### Named Rules
**The One Signal Rule.** Signal Orange marks what is next or live, plus focus. If something orange is neither, it is wrong. The logo's yellow is a mark, not a second accent.

**The Livery-Is-Data Rule.** Team colours come from the API (`teamColor` / `color`), never from frontend code. They appear as a 14% tint with a 2px inset edge on identity heads, and as bars, lines and dots elsewhere. Never as small text and never behind a code.

**The Dim-by-Colour Rule.** De-emphasise with Bezel Grey or Tick Grey, never `opacity`, so dimmed text keeps its contrast.

**The No-Red-Chrome Rule.** Red exists only as Fault Red in an error box and as a team's own colour in its data. The frame of the page is black.

## Typography

**Display Font:** Barlow Condensed (with Archivo, sans-serif), weights 300–600, always uppercase
**Body Font:** Archivo (with system-ui, sans-serif), variable width and weight

**Character:** Barlow Condensed is the instrument's engraving: thin, tall and exact, light (300) at large sizes so big figures stay precise rather than loud. Archivo explains everything the instrument shows, and carries the uppercase tracked nav.

### Hierarchy
- **Display** (300, clamp(40px, 5.2vw, 72px), 0.92): the next GP name in the Home hero, balanced across lines. The telemetry race name uses 400 at clamp(40px, 6vw, 72px).
- **Numeral** (300, clamp(64px, 8vw, 96px), 1): podium positions, whole inside their band. Chronograph hours and minutes run at 21% of the dial width; profile car numbers at 88px; Home podium steps at 44px.
- **Headline** (400, clamp(36px, 4.6vw, 52px), 0.02em): page titles (SectionHeading as h1).
- **Title** (500, 26px, 0.04em): section headings with their square marker.
- **Card Title** (500, 22px, 0.04em): every title inside a card (weekend schedule, standings panel, telemetry chart cards, race analyst).
- **Name** (400, 22px, 0.02em): driver and team names in rows; 19px in dense tables (telemetry results, H2H race log); 28–44px on podium bands.
- **Figures** (display 400): 28px in rows and facts, 34px in stat chips, 44px in stat tiles, 52px on podium bands. Units drop to Archivo 12–14px in Bezel Grey.
- **Body** (Archivo 400, 14px, 1.6): default text; sublines 12–13px.
- **Label** (Archivo 600, 12px): field labels, stat labels, chart axes. Table heads are 12px 700 uppercase at 0.06em.
- **Nav** (Archivo 600, 13px, 0.08em, uppercase): header nav pills and the season label; 12px at 0.05em on phones.

### Named Rules
**The Whole-Number Rule.** Numbers are never cropped by their container. A large position or car number sits entirely inside its band or panel.

**The Tabular Rule.** `tabular-nums` is global; numbers never jitter as they count.

**The Uppercase Display Rule.** Every use of the display face is uppercase. Body text is never uppercase except the nav and table heads.

## Layout

Content sits in a centred 1200px column (32px top, 24px sides, 56px bottom; 20/16/40px on phones) under a sticky 68px header, with a hairline footer. Spacing steps are 4 / 8 / 12 / 16 / 24 / 32px: 8–14px inside rows, 12–16px between tiles and panels, 24px card padding, 32px between Home sections.

- **Home:** the hero card (GP name, round and circuit, weekend schedule on the left; the 460px chronograph on the right), then three stat tiles, then three panels (last race, drivers, constructors), then the season strip of round cards.
- **Ranked pages (standings, results):** the podium bands, then the rest in one table card, beside a 340px sticky detail panel.
- **Tool pages (head-to-head, telemetry):** pill controls in a card, then identity heads or stat tiles, then tables and chart cards.
- **Breakpoints:** 1080px (Home panels and telemetry tiles to two columns), 900px (hero, ranked layout and header stack; nav wraps to its own row), 768/720px (single-column panels, simpler tables), 640px (tighter podium bands), 560px (telemetry tiles to one column), 420px (header divider hidden).
- No horizontal scroll at 390px.

## Elevation & Depth

Flat. Depth is a ladder of grounds, not shadows: Pit Black → Instrument Card → Raised Graphite → Pressed Graphite. State is shown with inset lines: a 2px inset team edge on identity heads, a 1px inset ring on a selected band, a 1px orange ring on the next session. Team bands hover with a brightness lift (`filter: brightness(1.25)`); dark rows hover one step up the ladder. The season picker's panel is the only floating surface, and it is drawn as a card with a strong hairline rather than a shadow.

**The Ground-Ladder Rule.** If something needs emphasis it moves one step up the ladder or takes an inset line. Nothing gets a drop shadow.

## Shapes

Small, exact corners. Cards, tables, tiles, the hero and the podium stack round to 6px and clip their children, so stacked bands share one outline with 3px gaps. Inner panels, notices, stat chips, tooltips and the search field use 4px; rows 8px; bars and tracks 2–3px. Every control (nav, chips, selects, buttons, badges, round tags, decade chips) is a full pill. Tick scales are square (radius 0). Borders are 1px hairlines; the heaviest line is a 2px team edge.

## Components

### Buttons
Restrained and certain.
- **Primary:** a Dial White pill with Pit Black 600–700 text, 44px tall; hover goes to pure white. One per context ("Open race analysis", "Load analysis"). Disabled drops to Raised Graphite with Tick Grey text.
- **Outline pill:** a 1.5px current-colour border with 13px 700 text (Close, Play).
- **Text link:** Bezel Grey, underlined in Hairline Strong 4px below; hover turns both Dial White.

### Chips
- **Filter chips:** 44px pills with a Hairline Strong border and Bezel Grey 600 text, toggled with `aria-pressed`; pressed fills Dial White with Pit Black text.
- **Next badge:** a Signal Orange pill with Signal Ink 11–12px 700 text. **Done badge:** outlined pill in Tick Grey.
- **Heading badge:** an outlined pill beside a section title ("Round 17"), 12px 600 Bezel Grey.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** Instrument Card with a 1px Hairline border.
- **Internal Padding:** 24px (40px for the Home hero); tables 6px so rows run nearly edge to edge.
- **Identity head:** a 14% team tint over the card colour with a 2px inset team edge and Dial White text: the name in display type, a 13px 600 subline, and an optional car number in 88px light outline, whole and vertically centred at the right.

### Inputs / Fields
- **Select:** a Raised Graphite pill, Hairline Strong border, 44px, custom grey chevron, 14px 500 text; hover lifts the border to Tick Grey.
- **Field:** a 12px 600 Bezel Grey label stacked 6px above the control.
- **Focus:** the global 2px Signal Orange outline at a 2px offset. The caret is orange; text selection is orange with Signal Ink.

### Navigation
- **Header:** Pit Black at 94% with a hairline bottom edge. On the left, the pit-board logo mark (28px) and PIT WALL in 26px display 600 at 0.08em. Centred nav pills, and the season picker on the right (hidden on Telemetry, which has its own year picker).
- **Nav pills:** 44px, Nav type in Bezel Grey; hover goes Dial White on Raised Graphite; active fills Pressed Graphite.
- **Mobile (≤900px):** brand and season on the first row, nav pills on one row beneath.

### Season Picker (signature)
A pill showing the season in 18px display type. It opens a 340px card holding:
- a search field (digits only: "1988" or "88" both find 1988, "19" finds the 1900s; Enter picks the top match);
- a row of decade chips, 1950s to 2020s;
- that decade's years as a 5-column grid of 44px cells in 20px display type.

The current season is pressed (Dial White fill). The card opens with a 160ms exponential ease-out, and closes on Escape or a click outside.

### Chronograph (signature)
The Home hero dial:
- 60 ticks; the seconds still left in the current minute stay lit;
- an orange seconds hand sweeping from `requestAnimationFrame` (stepped once a second under reduced motion);
- a minute-register arc draining through the hour;
- days, hours and minutes as light display digits in the face, with the seconds in orange.

On load the ticks draw in around the ring and the hand extends.

### Tick Scale (signature)
The dial's tick ring unrolled into a straight rule (`.tick-scale`, `--ticks` = units): 1px Tick Grey ticks over a Hairline Strong baseline. It runs under the title-gap track, the lap track tile and the race analyst's lap slider.

### Podium Bands
The top three as stacked identity heads in finishing order inside one 6px-clipped stack: the position in Numeral type, whole and centred; the name; the subline; and the figure with its unit and detail. P1's band is taller (132px vs 108px). Bands are buttons when they open the detail panel.

### Standings Row
The dark-table row: an outlined 34px position (1.2px Bezel Grey stroke), the name over a 3px share bar in the team colour (or a team dot before the subline when there is no bar), a 12px subline, and the figure with its detail. Rows are divided by hairlines; hover steps to Raised Graphite and selection to Pressed Graphite (`aria-pressed`).

### Stat Tile
A card with one display number, a small label and one small chart that explains it: a gap track against points still available, a pip per round left, two win bars, a lap track with neutralisation marks, team-colour bars, a pit-stop column chart.

### Notices
A missing dataset (a 503) is an Instrument Card notice in Bezel Grey with a bold lead ("Not available yet"). Only real failures use the error box with its Fault Red border.

## Do's and Don'ts

### Do:
- **Do** keep the page black and every data surface on the ground ladder (Instrument Card, Raised Graphite, Pressed Graphite).
- **Do** set headings, names and figures in Barlow Condensed uppercase, light (300) at display sizes.
- **Do** keep large numbers whole inside their container.
- **Do** use Signal Orange only for next, live, focus and the seconds hand.
- **Do** take team colours from the API and show them as a tint plus 2px edge on identity heads, and as bars, lines or dots elsewhere.
- **Do** show drivers and teams by name.
- **Do** build controls as 44px pills and mark toggles with `aria-pressed`.
- **Do** borrow the tick scale for any timeline or range under a figure.
- **Do** show missing data as a calm notice, not the error box.
- **Do** stop every looping motion under `prefers-reduced-motion`.

### Don't:
- **Don't** bring back maroon bands, red frame edges, the scrolling marquee, or giant outlined numerals cropped by their band.
- **Don't** use the logo's yellow anywhere but the logo mark.
- **Don't** put a driver's three-letter code in a coloured box, show driver photos, or show constructor logos.
- **Don't** hardcode a team colour in React, or set small text in a team colour.
- **Don't** add drop shadows; step up the ground ladder or use an inset line.
- **Don't** dim text with `opacity`.
- **Don't** use official Formula 1 logos, wordmarks or marks; the product is an unofficial fan project.
