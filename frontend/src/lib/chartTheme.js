// Recharts takes colours as SVG attributes, where CSS variables don't resolve,
// so the chart palette mirrors the :root tokens in index.css.
export const GRID = '#2A2A2E'          // --border
export const AXIS = '#3B3B40'          // --border-strong
export const TICK = '#A9A9B0'          // --text-muted
export const MUTED_SERIES = '#3B3B40'  // non-highlighted bars and lines
export const tick = { fontSize: 12, fill: TICK }
