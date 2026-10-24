import { useState, useEffect } from 'react'
import SectionHeading from './SectionHeading'
import styles from './ui.module.css'

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
    <div className={styles.loader} role="status">
      <div className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
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
      <div role="status" className={styles.notice}>
        <span className={styles.noticeLead}>Not available yet.</span> {text}
      </div>
    )
  }

  return (
    <div role="alert" className={styles.error}>
      {context ? `${context} error: ` : ''}{text}
    </div>
  )
}

export function TeamDot({ color, size = 10 }) {
  return <span className={styles.teamDot} style={{ width: size, height: size, background: color }} />
}

export function StatCard({ label, value, sub, accent }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} style={accent ? { color: accent } : undefined}>{value ?? '—'}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  )
}

/** Page title (the page's h1) with an optional badge. */
export function SectionHeader({ title, count }) {
  return <SectionHeading as="h1" title={title} badge={count} />
}
