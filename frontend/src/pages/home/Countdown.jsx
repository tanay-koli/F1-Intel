import { useEffect, useRef } from 'react'
import { useNow } from '../../hooks/useNow'
import { countdownTarget } from './weekend'
import styles from './Chronograph.module.css'

const pad = (n) => String(n).padStart(2, '0')
const TICKS = Array.from({ length: 60 }, (_, i) => i)
const R_OUT = 190
const R_REG = 138 // minute register

/** Degrees the hand sits at: the seconds already gone in the current minute, so it reaches 12 as a minute ticks off. */
function handDeg(target, ms, stepped) {
  const left = target ? Math.max(0, target - ms) / 1000 : 60 - (ms / 1000) % 60
  const gone = (60 - (left % 60)) % 60
  return (stepped ? Math.floor(gone) : gone) * 6
}

/** The countdown as a chronograph: lit ticks are the seconds left in this minute, the arc is what's left of the hour. */
export default function Countdown({ sessions }) {
  const now = useNow(1000)
  const target = countdownTarget(sessions, now)
  const at = target?.at ?? null
  const hand = useRef(null)

  // Smooth sweep from the clock, outside React; stepped once a second under reduced motion
  useEffect(() => {
    const stepped = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf
    const frame = () => {
      hand.current?.setAttribute('transform', `rotate(${handDeg(at, Date.now(), stepped)})`)
      raf = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [at])

  const total = at ? Math.max(0, Math.floor((at - now) / 1000)) : 0
  const secs = total % 60
  const gone = at ? (60 - secs) % 60 : 0
  const hourLeft = (total % 3600) / 3600
  const days = Math.floor(total / 86400)
  const hrs = Math.floor(total / 3600) % 24
  const mins = Math.floor(total / 60) % 60

  return (
    <div className={styles.chrono}>
      <svg className={styles.dial} viewBox="-200 -200 400 400" aria-hidden="true">
        <circle r={R_OUT + 8} className={styles.face} />
        {TICKS.map(i => {
          const major = i % 5 === 0
          return (
            <line
              key={i}
              y1={-R_OUT}
              y2={-(R_OUT - (major ? 18 : 9))}
              transform={`rotate(${i * 6})`}
              className={`${styles.tick} ${major ? styles.major : ''} ${i >= gone ? styles.lit : ''}`}
              style={{ '--i': i }}
            />
          )
        })}
        {TICKS.filter(i => i % 15 === 0).map(i => {
          const a = (i * 6 - 90) * Math.PI / 180
          return (
            <text key={i} x={Math.cos(a) * 155} y={Math.sin(a) * 155} className={styles.numeral}>
              {i === 0 ? 60 : 60 - i}
            </text>
          )
        })}
        <circle r={R_REG} className={styles.registerTrack} />
        {at && (
          <circle r={R_REG} pathLength="1" className={styles.register} strokeDasharray={`${hourLeft} 1`} />
        )}
        <g ref={hand}>
          <line y1={-118} y2={-(R_OUT + 4)} pathLength="1" className={styles.hand} />
          <circle cy={-112} r={4} className={styles.handTip} />
        </g>
      </svg>

      <div className={styles.readout}>
        <p className={styles.label} id="countdown-label">{target ? target.label : 'Race weekend in progress'}</p>
        {target && (
          <div role="timer" aria-labelledby="countdown-label" className={styles.time}>
            {days > 0 && <span className={styles.days}>{days} {days === 1 ? 'day' : 'days'}</span>}
            <span className={styles.hm} aria-hidden="true">
              {pad(hrs)}<span className={styles.colon}>:</span>{pad(mins)}
            </span>
            <span className={styles.secs} aria-hidden="true">
              {pad(secs)}<span className={styles.unit}> s</span>
            </span>
            <span className={styles.srOnly}>{hrs} hours {mins} minutes {secs} seconds</span>
          </div>
        )}
      </div>
    </div>
  )
}
