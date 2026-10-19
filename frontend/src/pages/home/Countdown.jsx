import { useNow } from '../../hooks/useNow'
import { countdownTarget } from './weekend'
import styles from './Home.module.css'

const pad = (n) => String(n).padStart(2, '0')

export default function Countdown({ sessions }) {
  const now = useNow(1000)
  const target = countdownTarget(sessions, now)

  if (!target) {
    return <p className={styles.countdownLabel}>Race weekend in progress</p>
  }

  const total = Math.max(0, Math.floor((target.at - now) / 1000))
  const units = [
    { value: Math.floor(total / 86400),     label: 'days' },
    { value: Math.floor(total / 3600) % 24, label: 'hrs' },
    { value: Math.floor(total / 60) % 60,   label: 'min' },
    { value: total % 60,                    label: 'sec' },
  ]

  return (
    <div className={styles.countdown}>
      <p className={styles.countdownLabel} id="countdown-label">{target.label}</p>
      <div role="timer" aria-labelledby="countdown-label" className={styles.digits}>
        {units.map(u => (
          <div key={u.label} className={styles.unit}>
            <span className={styles.digit}>{pad(u.value)}</span>
            <span className={styles.unitLabel}>{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
