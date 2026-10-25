// Recharts takes colours as SVG attributes, where CSS variables don't resolve,
// so the chart palette mirrors the :root tokens in index.css.
export const GRID = '#232327'          // --border
export const AXIS = '#34343A'          // --border-strong
export const TICK = '#A3A3AB'          // --text-muted
export const INK = '#EDEDEF'           // --text
export const MUTED_SERIES = '#34343A'  // non-highlighted bars and lines
export const tick = { fontSize: 12, fill: TICK, fontFamily: 'Archivo, system-ui, sans-serif' }
