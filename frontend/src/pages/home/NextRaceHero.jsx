import TrackOutline from '../../components/TrackOutline'
import Skeleton from '../../components/Skeleton'
import Countdown from './Countdown'
import WeekendSchedule from './WeekendSchedule'
import { countWord, surname, points } from '../../lib/format'
import styles from './Home.module.css'

/** Hero for a season with no race left: show how it finished instead of a countdown. */
function SeasonComplete({ season, standings }) {
  const [champ, second] = standings ?? []
  return (
    <section className={styles.hero} aria-labelledby="season-result">
      <div className={styles.heroMain}>
        {champ ? (
          <>
            <h1 id="season-result" className={styles.raceName}>{surname(champ)} won the {season} title</h1>
            {second && (
              <p className={styles.circuit}>
                {season} season complete. {points(champ.points - second.points)} points ahead of {surname(second)},
                with {countWord(champ.wins, 'win')}.
              </p>
            )}
          </>
        ) : (
          <>
            <h1 id="season-result" className={styles.raceName}>{season} season complete</h1>
            <p className={styles.circuit}>Final standings aren't available for {season}.</p>
          </>
        )}
      </div>
    </section>
  )
}

function HeroSkeleton() {
  return (
    <div className={styles.hero} aria-busy="true" aria-label="Loading next race">
      <div className={styles.heroMain}>
        <Skeleton width="80%" height={88} />
        <Skeleton width="45%" height={16} />
        <Skeleton width="70%" height={96} />
      </div>
      <div className={styles.heroAside}>
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={44} />)}
      </div>
    </div>
  )
}

export default function NextRaceHero({ season, nextRace, standings }) {
  if (nextRace.isLoading) return <HeroSkeleton />
  if (nextRace.isError) {
    return (
      <div className={styles.hero}>
        <p className={styles.panelMessage}>The next race isn't available right now.</p>
      </div>
    )
  }

  const race = nextRace.data?.race
  if (!race) return <SeasonComplete season={season} standings={standings.data?.standings} />

  return (
    <section className={styles.hero} aria-labelledby="next-race-name">
      <div className={styles.heroMain}>
        <h1 id="next-race-name" className={styles.raceName}>{race.raceName}</h1>
        <p className={styles.circuit}>
          <span className={styles.roundTag}>Round {race.round}</span>
          {race.circuitName}, {race.locality}
        </p>
        <div className={styles.countRow}>
          <Countdown sessions={race.sessions} />
          <div className={styles.trackBox}>
            <TrackOutline
              circuitId={race.circuitId}
              locality={race.locality}
              label={`${race.circuitName} layout`}
              fallback={<span className={styles.roundGhost} aria-hidden="true">R{race.round}</span>}
            />
          </div>
        </div>
      </div>
      <div className={styles.heroAside}>
        <WeekendSchedule sessions={race.sessions} />
      </div>
    </section>
  )
}
