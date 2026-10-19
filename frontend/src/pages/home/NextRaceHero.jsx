import TrackOutline from '../../components/TrackOutline'
import Skeleton from '../../components/Skeleton'
import Countdown from './Countdown'
import WeekendSchedule from './WeekendSchedule'
import { titleContext } from '../../lib/titleMath'
import { countWord, surname, points } from '../../lib/format'
import styles from './Home.module.css'

function TitleLine({ context, city }) {
  if (!context) return null
  const { leader, second, gap, racesLeft, clinched, canClinchThisWeekend } = context
  if (clinched) {
    return (
      <p className={styles.context}>
        {surname(leader)} has won the title, {points(gap)} points clear of {surname(second)}.
      </p>
    )
  }
  return (
    <p className={styles.context}>
      {surname(leader)} leads {surname(second)} by {points(gap)} {gap === 1 ? 'point' : 'points'} with{' '}
      {countWord(racesLeft, 'race')} left{canClinchThisWeekend ? ` and can seal the title in ${city}.` : '.'}
    </p>
  )
}

/** Hero for a season with no race left: show how it finished instead of a countdown. */
function SeasonComplete({ season, standings }) {
  const [champ, second] = standings ?? []
  return (
    <section className={`${styles.card} ${styles.hero}`} aria-labelledby="season-result">
      <div className={styles.heroMain}>
        <p className={styles.eyebrow}>{season} season complete</p>
        {champ ? (
          <>
            <h1 id="season-result" className={styles.raceName}>{surname(champ)} won the {season} title</h1>
            {second && (
              <p className={styles.circuit}>
                {points(champ.points - second.points)} points ahead of {surname(second)},
                with {countWord(champ.wins, 'win')}.
              </p>
            )}
          </>
        ) : (
          <p id="season-result" className={styles.panelMessage}>
            Final standings aren't available for {season}.
          </p>
        )}
      </div>
    </section>
  )
}

function HeroSkeleton() {
  return (
    <div className={`${styles.card} ${styles.hero}`} aria-busy="true" aria-label="Loading next race">
      <div className={styles.heroMain}>
        <Skeleton width={160} height={14} />
        <Skeleton width="70%" height={52} />
        <Skeleton width="45%" height={16} />
        <Skeleton width="80%" height={72} />
      </div>
      <div className={styles.heroAside}>
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={40} />)}
      </div>
    </div>
  )
}

export default function NextRaceHero({ season, nextRace, standings, schedule }) {
  if (nextRace.isLoading) return <HeroSkeleton />
  if (nextRace.isError) {
    return (
      <div className={`${styles.card} ${styles.hero}`}>
        <p className={styles.panelMessage}>The next race isn't available right now.</p>
      </div>
    )
  }

  const race = nextRace.data?.race
  if (!race) return <SeasonComplete season={season} standings={standings.data?.standings} />

  const remaining = (schedule.data?.races ?? []).filter(r => r.round >= race.round)
  const context = standings.data?.standings?.length && remaining.length
    ? titleContext(standings.data.standings, remaining)
    : null

  return (
    <section className={`${styles.card} ${styles.hero}`} aria-labelledby="next-race-name">
      <div className={styles.heroMain}>
        <p className={styles.eyebrow}>Next race, round {race.round}</p>
        <div className={styles.titleRow}>
          <div>
            <h1 id="next-race-name" className={styles.raceName}>{race.raceName}</h1>
            <p className={styles.circuit}>{race.circuitName}, {race.locality}</p>
          </div>
          <div className={styles.trackBox}>
            <TrackOutline
              circuitId={race.circuitId}
              locality={race.locality}
              label={`${race.circuitName} layout`}
            />
          </div>
        </div>
        <Countdown sessions={race.sessions} />
        <TitleLine context={context} city={race.locality} />
      </div>
      <div className={styles.heroAside}>
        <WeekendSchedule sessions={race.sessions} />
      </div>
    </section>
  )
}
