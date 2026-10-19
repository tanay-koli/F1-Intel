import { useNow } from '../../hooks/useNow'
import { startMs, endMs } from './weekend'
import styles from './Home.module.css'

const dayFmt  = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const zone    = Intl.DateTimeFormat().resolvedOptions().timeZone

export default function WeekendSchedule({ sessions }) {
  const now = useNow(30_000)
  const nextKey = sessions.find(s => startMs(s) > now)?.key

  return (
    <section aria-labelledby="schedule-heading">
      <h2 id="schedule-heading" className={styles.scheduleHeading}>Weekend schedule</h2>
      <p className={styles.zoneNote}>Shown in your time ({zone})</p>
      <ol className={styles.sessionList}>
        {sessions.map(s => {
          const done = endMs(s) < now
          const isNext = s.key === nextKey
          const d = new Date(s.start)
          return (
            <li
              key={s.key}
              className={`${styles.session} ${done ? styles.sessionDone : ''} ${isNext ? styles.sessionNext : ''}`}
            >
              <span className={styles.sessionName}>{s.name}</span>
              <time className={styles.sessionTime} dateTime={s.start}>
                {dayFmt.format(d)} · {timeFmt.format(d)}
              </time>
              <span className={styles.sessionBadgeSlot}>
                {done && <span className={styles.badgeDone}>Done</span>}
                {isNext && <span className={styles.badgeNext}>Next</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
