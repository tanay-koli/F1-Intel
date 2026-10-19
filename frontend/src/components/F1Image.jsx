/**
 * F1Image — resolves driver / constructor images from /public/images/
 * Falls back gracefully if no file is found.
 *
 * Usage:
 *   <DriverImage driverId="max_verstappen" size={80} />
 *   <ConstructorImage constructorId="red_bull" width={120} height={60} />
 */

import { useState } from 'react'

const DRIVER_EXTS      = ['webp', 'png', 'jpg', 'jpeg']
const CONSTRUCTOR_EXTS = ['webp', 'png', 'jpg', 'jpeg']

/** Try the next extension; if all exhausted, signal failure */
function nextSrc(base, exts, currentSrc) {
  const current = currentSrc.split('.').pop()
  const idx     = exts.indexOf(current)
  if (idx === -1 || idx === exts.length - 1) return null
  return `${base}.${exts[idx + 1]}`
}

/* ── Placeholder SVG avatar (shown when no image found) ────────────────────── */
function Placeholder({ size = 60, radius = 8, label = '?', color = '#e10600', alt }) {
  return (
    <div role={alt ? 'img' : undefined} aria-label={alt} style={{
      width: size, height: size, borderRadius: radius,
      background: `linear-gradient(135deg, ${color}22, ${color}44)`,
      border: `1px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--display)', fontSize: size * 0.32,
      color: color, userSelect: 'none', flexShrink: 0,
      letterSpacing: '0.04em',
    }}>
      {label}
    </div>
  )
}

/* ── Driver image ───────────────────────────────────────────────────────────── */
export function DriverImage({ driverId, size = 72, style = {}, color = '#e10600', initials = '?', alt }) {
  const base    = `/images/drivers/${driverId}`
  const [src, setSrc]       = useState(`${base}.${DRIVER_EXTS[0]}`)
  const [failed, setFailed] = useState(false)

  if (failed) return <Placeholder size={size} radius={size * 0.14} label={initials} color={color} alt={alt} />

  return (
    <img
      src={src}
      alt={alt ?? driverId}
      onError={() => {
        const next = nextSrc(base, DRIVER_EXTS, src)
        if (next) setSrc(next)
        else setFailed(true)
      }}
      style={{
        width: size, height: size,
        objectFit: 'cover',
        borderRadius: size * 0.14,
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

/* ── Constructor logo ───────────────────────────────────────────────────────── */
export function ConstructorImage({ constructorId, width = 110, height = 52, style = {}, color = '#e10600', name = '?', alt }) {
  const base    = `/images/constructors/${constructorId}`
  const [src, setSrc]       = useState(`${base}.${CONSTRUCTOR_EXTS[0]}`)
  const [failed, setFailed] = useState(false)

  if (failed) return (
    <Placeholder size={Math.max(width, height)} radius={6} label={name.slice(0, 3).toUpperCase()} color={color} alt={alt} />
  )

  return (
    <img
      src={src}
      alt={alt ?? constructorId}
      onError={() => {
        const next = nextSrc(base, CONSTRUCTOR_EXTS, src)
        if (next) setSrc(next)
        else setFailed(true)
      }}
      style={{
        width, height,
        objectFit: 'contain',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
