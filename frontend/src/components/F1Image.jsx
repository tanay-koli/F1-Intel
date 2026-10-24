/**
 * ConstructorImage — resolves a team logo from /public/images/constructors/,
 * trying each extension in turn, then falls back to the team's short name.
 *
 * Usage:
 *   <ConstructorImage constructorId="red_bull" width={120} height={60} />
 */

import { useState } from 'react'

const EXTS = ['webp', 'png', 'jpg', 'jpeg']

/** Try the next extension; null once all are exhausted */
function nextSrc(base, currentSrc) {
  const idx = EXTS.indexOf(currentSrc.split('.').pop())
  if (idx === -1 || idx === EXTS.length - 1) return null
  return `${base}.${EXTS[idx + 1]}`
}

export function ConstructorImage({ constructorId, width = 110, height = 52, style = {}, color = 'var(--border-strong)', name = '?', alt }) {
  const base = `/images/constructors/${constructorId}`
  const [src, setSrc]       = useState(`${base}.${EXTS[0]}`)
  const [failed, setFailed] = useState(false)

  if (failed) {
    const size = Math.max(width, height)
    return (
      <div role={alt ? 'img' : undefined} aria-label={alt} style={{
        width: size, height: size, borderRadius: 6, flexShrink: 0,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
        borderBottom: `3px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--display)', fontSize: size * 0.32, letterSpacing: '0.04em',
        color: 'var(--text-muted)', userSelect: 'none',
      }}>
        {name.slice(0, 3).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt ?? constructorId}
      onError={() => {
        const next = nextSrc(base, src)
        if (next) setSrc(next)
        else setFailed(true)
      }}
      style={{ width, height, objectFit: 'contain', flexShrink: 0, ...style }}
    />
  )
}
