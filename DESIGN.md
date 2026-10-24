---
name: Pit Wall
description: Season context, results and race analysis for F1, from 1950 to now.
colors:
  night-ground: "#0A0A0B"
  data-card: "#141416"
  data-raised: "#1C1C1F"
  selected-grey: "#2E2E33"
  hairline: "#2A2A2E"
  hairline-strong: "#3B3B40"
  maroon-frame: "#6E0A10"
  maroon-deep: "#2C0306"
  frame-line: "#A3101A"
  frame-text: "#F5D7D9"
  start-light-red: "#E10600"
  start-light-red-dim: "#991004"
  safety-amber: "#FFC940"
  amber-ink: "#14130D"
  grid-white: "#F3F3F4"
  telemetry-grey: "#A9A9B0"
  telemetry-grey-dim: "#8F8F97"
typography:
  display:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "clamp(56px, 8.4vw, 120px)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "0.005em"
  numeral:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "clamp(96px, 13vw, 168px)"
    fontWeight: 400
    lineHeight: 0.8
  countdown:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(56px, 8vw, 108px)"
    fontWeight: 800
    lineHeight: 0.9
    fontVariation: "'wdth' 70"
  headline:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "clamp(40px, 6vw, 64px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.01em"
  title:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.03em"
  name:
    fontFamily: "Bebas Neue, sans-serif"
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
rounded:
  xs: "4px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  card: "16px"
  hero: "20px"
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
    backgroundColor: "{colors.maroon-frame}"
    textColor: "{colors.frame-text}"
    height: "68px"
  nav-pill:
    textColor: "{colors.frame-text}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "44px"
  nav-pill-active:
    backgroundColor: "{colors.night-ground}"
    textColor: "{colors.grid-white}"
  card:
    backgroundColor: "{colors.data-card}"
    textColor: "{colors.grid-white}"
    rounded: "{rounded.card}"
    padding: "24px"
  table-row:
    textColor: "{colors.grid-white}"
    rounded: "{rounded.sm}"
    padding: "8px 12px 8px 4px"
    height: "60px"
  table-row-hover:
    backgroundColor: "{colors.data-raised}"
  table-row-selected:
    backgroundColor: "{colors.selected-grey}"
  chip:
    textColor: "{colors.telemetry-grey}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  chip-pressed:
    backgroundColor: "{colors.grid-white}"
    textColor: "{colors.night-ground}"
  select:
    backgroundColor: "{colors.data-raised}"
    textColor: "{colors.grid-white}"
    rounded: "{rounded.pill}"
    padding: "0 36px 0 16px"
    height: "44px"
  button-primary:
    backgroundColor: "{colors.grid-white}"
    textColor: "{colors.night-ground}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "44px"
  stat-tile:
    backgroundColor: "{colors.data-card}"
    textColor: "{colors.grid-white}"
    rounded: "{rounded.card}"
    padding: "20px 22px"
  stat-chip:
    backgroundColor: "{colors.data-raised}"
    textColor: "{colors.grid-white}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
  badge-next:
    backgroundColor: "{colors.safety-amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  site-footer:
    backgroundColor: "{colors.maroon-frame}"
    textColor: "{colors.frame-text}"
    padding: "24px"
---

# Design System: Pit Wall

## Overview

**Creative North Star: "The Race Programme Wall"**

A race-day programme pinned to a timing wall: red is the frame, black is the data ground. Maroon bands with a bright red edge run across the header, the footer, the Home hero and the GP marquee; everything that holds data sits on near-black, so a team's colour never has to fight the red around it. The page reads like a poster first and a timing sheet second: grand-prix names and positions at poster scale in condensed caps, then dark tables and stat tiles that scan line by line.

Team colour is the loudest thing on a data surface, and it is earned. The top three in a standing stand in full livery bands with their position set huge; head-to-head sides, the open profile panel and the telemetry driver head take a band too. Everyone else carries their colour as a code chip, a share bar or a dot. Numbers are oversized and often outlined, so a ranked list reads as a column of giant ghost numerals rather than a list of avatars.

Controls are pills: nav, filter chips, selects, the one white primary action. Cards are softly rounded (16px) dark slabs divided by hairlines. There are no driver photos; a driver is their three-letter code on their team colour.

**Key Characteristics:**
- Maroon frame bands with a 3px Start-Light Red edge; near-black data ground.
- Team colour as full bands on the top three and on driver-identity heads, as chips, bars and dots everywhere else, always from the API.
- Oversized outlined (text-stroke) position, round and car numbers.
- Pill controls: nav, filter chips (`aria-pressed`), selects, primary button.
- Dark tables inside 16px cards with hairline row dividers.
- Stat tiles: one big number, a small label, one small bespoke chart.
- Amber only for "next" and the focus ring.

## Colors

Near-black ground, a maroon-to-red frame, and colour on data only when it means a team or "next".

### Primary
- **Maroon Frame** (#6E0A10): the frame. Header and footer bands, the GP marquee band, the light end of the Home hero gradient, and a faint radial wash at the top of the page background.
- **Maroon Deep** (#2C0306): the dark end of the Home hero gradient.
- **Frame Line** (#A3101A): text selection highlight; a brighter maroon for lines on the frame.
- **Frame Text** (#F5D7D9): secondary text, unit labels and outlined marquee strokes on the frame (at least 4.5:1 on Maroon Frame). Primary text on the frame is pure white.
- **Start-Light Red** (#E10600): the bright edge. The 3px border where a frame band meets the ground, the section-heading bars, the loading spinner arc, the gap-chart fill on Home, and native control accents (`accent-color`).
- **Start-Light Red Dim** (#991004): the error box border and scrollbar thumb hover.

### Secondary
- **Safety Amber** (#FFC940): "next" only: the next session row's inset ring and badge, the next round's filled number in the season strip and calendar, and the global focus ring. Also the text caret.
- **Amber Ink** (#14130D): text on Safety Amber fills.

### Neutral
- **Night Ground** (#0A0A0B): the page ground; also the active nav pill and season select on the header, and the text on white pills.
- **Data Card** (#141416): every card, table, tile and panel that holds data.
- **Data Raised** (#1C1C1F): rows on hover, stat chips inside panels, inputs, chart tooltips, chart tracks.
- **Selected Grey** (#2E2E33): the selected row in a table.
- **Hairline** (#2A2A2E) and **Hairline Strong** (#3B3B40): row dividers and card borders; Strong for chip, select and table-head borders.
- **Grid White** (#F3F3F4): primary text, the fill of pressed chips and the primary button, and the light chip behind constructor logos.
- **Telemetry Grey** (#A9A9B0): secondary text, labels, units, and the stroke of outlined numbers. At least 4.5:1 on every card colour.
- **Telemetry Grey Dim** (#8F8F97): finished sessions, disabled controls, the quietest text that still clears 4.5:1 on cards.

### Named Rules
**The Red Frame Rule.** Maroon and red frame the page; they never hold data. Maroon bands carry the header, footer, Home hero and marquee, each edged in 3px Start-Light Red. Every surface that holds team-coloured data is near-black, so a team colour never sits on red.

**The Livery-Is-Data Rule.** Team colour comes from the API (`teamColor` / `color`), never from frontend code. It appears as a full band only on the top three (Podium), the two H2H sides, the profile panel head and the telemetry deep-dive head, with text on it chosen by `inkOn` (near-black or white, whichever contrasts more). Everywhere else it is a code chip, a bar or a dot, never small text.

**The One Next Rule.** Safety Amber marks what comes next (plus the focus ring). If something amber is not "next" or focus, it is wrong.

**The Dim-by-Colour Rule.** De-emphasise text with Telemetry Grey or Grey Dim, not `opacity`, so dimmed text keeps its contrast.

## Typography

**Display Font:** Bebas Neue (with sans-serif)
**Body Font:** Archivo, variable width axis (with system-ui, sans-serif)

**Character:** Bebas Neue is the race-poster voice for anything you'd read off a programme cover or a timing tower: GP names, headings, driver and team names, positions, points. Archivo explains; at weight 800 squeezed to 70% width it sets the countdown digits.

### Hierarchy
- **Display** (Bebas Neue 400, clamp(56px, 8.4vw, 120px), 0.86, uppercase): the next GP name in the Home hero. The marquee band uses the same face at clamp(44px, 6vw, 72px), alternating filled white and outlined copies.
- **Numeral** (Bebas Neue 400, clamp(96px, 13vw, 168px), 0.8): podium position numbers, cropped by the band's bottom edge. Profile car numbers (128px) and H2H driver codes (132px) are the same family, outlined.
- **Countdown** (Archivo 800 at 70% width, clamp(56px, 8vw, 108px), 0.9): countdown digits, white on the hero, with 12px 700 uppercase unit labels in Frame Text.
- **Headline** (Bebas Neue 400, clamp(40px, 6vw, 64px), uppercase): page titles (SectionHeading as h1); the telemetry race name at clamp(40px, 6vw, 72px).
- **Title** (Bebas Neue 400, 30px, 0.03em, uppercase): section headings beside the red bar; panel titles at 26px.
- **Name** (Bebas Neue 400, 22px, 0.02em, uppercase): names in table rows. Figures beside them run 28px (row values, panel facts) to 34px (stat chips) to 44–56px (stat tiles).
- **Body** (Archivo 400, 14px, 1.6): default text, sublines at 12–13px.
- **Label** (Archivo 600, 12px): field labels, stat labels, units, sublines in Telemetry Grey. Table column heads are 12px 700 uppercase at 0.06em.

### Named Rules
**The Outlined Numeral Rule.** Position, round and car numbers are set oversized in the display face and drawn as an outline (`-webkit-text-stroke`): 1.2px Telemetry Grey on dark rows and round cards, 2px ink on a team band. A number fills solid only when it is the band's own position (Podium, Home podium steps) or the next round (Safety Amber).

**The Tabular Rule.** `tabular-nums` is global; numbers never jitter as they update.

**The Unit-Drops Rule.** A figure is display type; its unit ("pts", "s", "left") drops to Archivo 12–15px, in Telemetry Grey on dark and in the band's ink on a band.

## Layout

Content sits in a centred 1200px column (32px top, 24px sides, 56px bottom; 20/16/40px on phones) between a sticky 68px maroon header and a maroon footer. The GP marquee breaks out of the column to the full viewport width. Spacing steps are 4 / 8 / 12 / 16 / 24 / 32px: 8–14px inside rows, 16px between tiles and panels, 24px card padding, 32px between Home sections (24px on phones).

- **Home:** the maroon hero (GP name and countdown left, a 380px dark weekend-schedule table right, with the outlined round number standing in for the circuit outline), the marquee band, three stat tiles, three panels (last race, drivers, constructors), then the season strip of round cards joined by 1px hairline gaps.
- **Ranked pages (standings, results):** the Podium bands, then the rest of the table in one dark card, beside a 340px sticky detail panel.
- **Tool pages (H2H, Telemetry):** pill controls in a dark card, then team bands or stat tiles, then dark tables.
- **Breakpoints:** 1080px (Home panels to 2 columns, telemetry tiles to 2), 900px (hero, ranked layout and header nav stack; nav wraps to its own row), 768/720px (single-column panels, H2H hides the oversized codes, tables simplify), 640px (podium bands drop the logo and tighten), 560px (telemetry tiles to 1), 420px (header divider hidden).
- No horizontal scroll at 390px.

## Elevation & Depth

No drop shadows. Depth is the ground ladder (Night Ground → Data Card → Data Raised → Selected Grey) plus the red frame bands, which sit above everything visually through colour, not lift. State is shown with inset rings: an inset 3px ink ring on a selected podium band, an inset 1px amber ring on the next session. Team bands hover with a slight brightness lift (`filter: brightness(1.08)`); dark rows hover one step up the ladder. The Home hero's schedule table sits on 82% Night Ground over the maroon gradient.

**The Ground-and-Band Rule.** A surface is either ground (dark, holds data) or band (maroon frame or team livery). Nothing floats; if something needs emphasis, it becomes a band or moves one step up the ground ladder.

## Shapes

Two shapes: soft slabs and pills. Cards, tables, tiles, podium stacks and team-band groups round to 16px (the Home hero 20px) and clip their children, so stacked bands share one rounded outline with 3–4px dark gaps between them. Notices, stat chips and inner panels use 12px; logo chips and tooltips 10px; rows 8px; chart tracks 3–4px. Every control (nav, chips, selects, buttons, badges, round tags) is a full pill. Home podium steps have rounded tops and square bottoms. Borders are 1px hairlines; the only heavy strokes are the 3px red frame edges.

## Components

### Buttons
- **Primary:** a Grid White pill with Night Ground 600–700 text, 44px tall; hover goes to pure white. One per context ("Open race analysis", the telemetry run button). Disabled drops to Data Raised with Grey Dim text.
- **Outline pill:** 1px Hairline Strong border, 13px 700 text, for Close and Play; on a team band the border and text take the band's ink.
- **Text link:** Telemetry Grey, underlined in Hairline Strong 4px below; hover turns both to Grid White.

### Chips
- **Filter chips (tabs):** 44px pills with a Hairline Strong border and Telemetry Grey 600 text, toggled with `aria-pressed`. Pressed fills Grid White with Night Ground text.
- **Next badge:** Safety Amber pill, Amber Ink 11–12px 700 text. **Done badge:** outlined pill in Grey Dim.
- **Heading badge:** outlined pill beside a section title ("Round 17"), 12px 600 Telemetry Grey.
- **Tags:** small outlined pills for fastest lap, sprint and similar flags.

### Cards and Containers
- **Corner Style:** 16px.
- **Background:** Data Card with a 1px Hairline border.
- **Internal Padding:** 24px (18px on phones); tables 6px so rows run nearly edge to edge.
- **Detail panel:** a team-colour head (112px+, name in display type, an oversized outlined car number cropped at the right edge) over a dark body of stat chips and hairline-divided facts.

### Inputs and Fields
- **Pill select:** Data Raised, Hairline Strong border, full pill, 44px, custom grey chevron, 14px 500 text. On the header it sits on Night Ground in 20px display type. Hover lifts the border to Grey Dim.
- **Field:** a 12px 600 Telemetry Grey label stacked 6px above the control.
- **Focus:** the global 2px Safety Amber outline at a 2px offset (inset 5px on podium bands).

### Navigation
- **Header:** a sticky Maroon Frame band with a 3px Start-Light Red bottom edge, the PIT WALL wordmark in 34px display type (PIT white, WALL in Frame Text), centred nav pills, and the season select at the right.
- **Nav pills:** 44px, Frame Text 600. Hover darkens with a 28% black wash; active fills Night Ground with white text.
- **Mobile (≤900px):** brand and season on the first row, nav pills wrapping underneath.

### Footer
A Maroon Frame band with a 3px red top edge: the PIT WALL name in display type, the data sources, and the disclaimer ("Unofficial fan project. Not affiliated with Formula 1 or any team. Logos are trademarks of their owners.") in 13px Frame Text.

### Podium Bands (signature)
The top three as full-width bands in finishing order inside one 16px-clipped stack, each in its team colour with `inkOn` text: the position at Numeral scale cropped by the band's bottom edge, an optional logo chip, the name in display type, and the figure with its unit and gap. P1's band is taller (132px vs 108px). Bands are buttons when they open the detail panel.

### Standings Table (signature)
The rest of the order as a dark table inside a 16px card: outlined 34px position, DriverMark or constructor logo chip, the name over a 3px share bar in the team colour, a Telemetry Grey subline, and the figure with its gap. Rows are divided by hairlines; hover steps to Data Raised, selection to Selected Grey (`aria-pressed`). The same table grammar carries the calendar, the H2H log, the telemetry race table and the weekend schedule.

### Stat Tile (signature)
A 16px Data Card tile holding one big display number (44–56px) with its unit, a small Telemetry Grey label, and one small bespoke chart that explains the number: a gap track against points still available, a pip per round left (sprints taller), two win bars, a lap track with neutralisation marks, fastest-lap or places-gained bars in team colour, a pit-stop column chart.

### Driver Mark
No driver photos. A driver is their three-letter code in display type on a square of their team colour (radius 18% of size), text chosen by `inkOn`. Constructor logos sit on a Grid White chip (8–10px radius, 4–6px padding) so every logo reads on dark and on bands.

### GP Marquee
A full-bleed Maroon Frame band with 3px red edges above and below, scrolling the GP name and year in display type (48s loop), alternating filled white and Frame Text outline copies. It stops under `prefers-reduced-motion`.

### Section Heading
A display-font title with an inline red bar (0.13em by 0.8em, so it stays with the first line when the title wraps), an optional outlined pill badge, and a right-aligned text link. As an h1 it sets at page-title scale.

## Do's and Don'ts

### Do:
- **Do** frame with maroon bands and a 3px Start-Light Red edge, and keep every surface that holds data on the near-black ground.
- **Do** take team colours from the API and pick text on them with `inkOn`; use full bands only for the top three and driver-identity heads, and chips, bars or dots elsewhere.
- **Do** set positions, round numbers and car numbers oversized in Bebas Neue, outlined on dark (1.2px Telemetry Grey) and on bands (2px ink).
- **Do** build controls as 44px pills; mark toggles with `aria-pressed`.
- **Do** put tables in a 16px Data Card with hairline row dividers.
- **Do** give each stat tile one number, one label and one small chart that explains it.
- **Do** show a driver as a DriverMark with their three-letter code, and constructor logos on a Grid White chip.
- **Do** stop every looping motion (the marquee, spinners) under `prefers-reduced-motion`.
- **Do** show missing data as a calm notice (`ErrorMsg`'s "Not available yet"), not the red error box.
- **Do** keep the footer disclaimer on every page.

### Don't:
- **Don't** put team colour on a red or maroon surface.
- **Don't** set small text in a team colour; it fails contrast against too many liveries.
- **Don't** hardcode a team colour in React.
- **Don't** use Safety Amber for anything but "next" and focus.
- **Don't** add drop shadows; use a band, a ground step or an inset ring.
- **Don't** use driver photos.
- **Don't** dim text with `opacity`; use Telemetry Grey or Grey Dim.
- **Don't** use official Formula 1 logos, wordmarks or marks; the product is an unofficial fan project.
