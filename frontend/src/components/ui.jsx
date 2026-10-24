import { useState, useEffect } from 'react'
import SectionHeading from './SectionHeading'

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
      <span style={{ fontSize: 13 }}>{label}</span>
    </div>
  )
}

/**
 * Error box. Pass `error` (an axios error; api.js puts the API's message on
 * error.message) or a plain `message`. `context` prefixes real errors, e.g.
 * "Race analysis error: …". A 503 means the data doesn't exist yet (no timing
 * data, rate limit), so it reads as "not available yet", not as a crash.
 */
export function ErrorMsg({ message, error, context }) {
  const text = (error ? error.message : message) || 'Something went wrong'

  if (error?.response?.status === 503) {
    return (
      <div role="status" style={{
        padding: '12px 16px', background: 'var(--bg-elevated)',
        border: '1px solid var(--border)', borderRadius: 8,
        color: 'var(--text-muted)', fontSize: 13
      }}>
        Not available yet: {text}
      </div>
    )
  }

  return (
    <div role="alert" style={{
      padding: '12px 16px', background: '#1a0505',
      border: '1px solid var(--red-dim)', borderRadius: 8,
      color: '#ff6b6b', fontSize: 13
    }}>
      {context ? `${context} error: ` : ''}{text}
    </div>
  )
}

export function TeamDot({ color, size = 10 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      borderRadius: '50%', background: color,
      flexShrink: 0
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
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--display)', fontSize: 28, lineHeight: 1,
        color: accent || 'var(--text)'
      }}>
        {value ?? '—'}
      </span>
      {sub && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  )
}

/** Page title (the page's h1) with an optional badge. */
export function SectionHeader({ title, count }) {
  return <SectionHeading as="h1" title={title} badge={count} />
}
