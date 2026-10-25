const luminance = (hex) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6).padEnd(6, '0'), 16)
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Text colour (near-black or white) with the better contrast on a team colour. */
export function inkOn(hex) {
  if (!hex?.startsWith('#')) return '#FFFFFF'
  const L = luminance(hex)
  // Contrast vs black (L≈0.003) against contrast vs white (L=1)
  return (L + 0.05) / 0.053 > 1.05 / (L + 0.05) ? '#09090A' : '#FFFFFF'
}
