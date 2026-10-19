import SectionHeading from '../../components/SectionHeading'
import Skeleton from '../../components/Skeleton'
import { withSeason } from '../../hooks/useSeason'
import { countWord, shortGpName, weekendRange } from '../../lib/format'
import styles from './Home.module.css'

export default function SeasonStrip({ season, schedule, nextRound }) {
  // No next race means the season is over, so nothing is left to show
  const remaining = nextRound
    ? (schedule.data?.races ?? []).filter(r => r.round >= nextRound)
    : []

  if (!schedule.isLoading && !schedule.isError && !remaining.length) return null

  return (
    <section aria-labelledby="season-strip-heading">
      <SectionHeading
        id="season-strip-heading"
        title="Rest of the season"
        badge={remaining.length ? `${countWord(remaining.length, 'race')} left` : undefined}
        link={{ to: withSeason('/calendar', season), label: 'Full calendar' }}
      />

      {schedule.isLoading && (
        <div className={styles.strip} aria-busy="true" aria-label="Loading calendar">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} width={150} height={104} radius={10} />)}
        </div>
      )}

      {schedule.isError && <p className={styles.panelMessage}>The calendar isn't available right now.</p>}

      {remaining.length > 0 && (
        <ol className={styles.strip}>
          {remaining.map(r => {
            const isNext = r.round === nextRound
            return (
              <li key={r.round} className={`${styles.roundCard} ${isNext ? styles.roundNext : ''}`}>
                <span className={styles.roundNum}>
                  <span className={styles.srOnly}>Round </span>R{r.round}
                  {isNext && <span className={styles.srOnly}> (next race)</span>}
                </span>
                <span className={styles.roundDates}>{weekendRange(r.fp1 || r.date, r.date)}</span>
                <span className={styles.roundName}>{shortGpName(r.raceName)}</span>
                <span className={styles.roundCity}>{r.locality}</span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
