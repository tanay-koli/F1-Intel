import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return isMobile
}


export function Loader({ label = 'Loading...' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12, padding: 48, color: 'var(--text-muted)'
    }}>
      <div style={{
        width: 32, height: 32,
        border: '2px solid var(--border)',
        borderTopColor: 'var(--red)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{label}</span>
    </div>
  )
}

export function ErrorMsg({ message }) {
  return (
    <div style={{
      padding: '12px 16px', background: '#1a0505',
      border: '1px solid var(--red-dim)', borderRadius: 8,
      color: '#ff6b6b', fontFamily: 'var(--mono)', fontSize: 12
    }}>
      ⚠ {message || 'Something went wrong'}
    </div>
  )
}

export function TeamDot({ color, size = 10 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      borderRadius: '50%', background: color,
      flexShrink: 0, boxShadow: `0 0 6px ${color}80`
    }} />
  )
}

export function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 18px',
      display: 'flex', flexDirection: 'column', gap: 4
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--display)', fontSize: 28, lineHeight: 1,
        color: accent || 'var(--text)'
      }}>
        {value ?? '—'}
      </span>
      {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  )
}

export function SectionHeader({ title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
      <h2 style={{ fontFamily: 'var(--display)', fontSize: 32, letterSpacing: '0.04em', color: 'var(--text)' }}>
        {title}
      </h2>
      {count !== undefined && (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 11,
          color: 'var(--text-muted)', background: 'var(--bg-elevated)',
          padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)'
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

export function PositionBadge({ position }) {
  const gold   = position === 1 ? '#FFD700' : null
  const silver = position === 2 ? '#C0C0C0' : null
  const bronze = position === 3 ? '#CD7F32' : null
  const color  = gold || silver || bronze || 'var(--text-muted)'
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600,
      color, minWidth: 24, display: 'inline-block', textAlign: 'right'
    }}>
      P{position}
    </span>
  )
}
