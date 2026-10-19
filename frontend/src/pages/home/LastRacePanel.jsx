import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../../api'
import { DriverImage } from '../../components/F1Image'
import SectionHeading from '../../components/SectionHeading'
import Skeleton from '../../components/Skeleton'
import { withSeason } from '../../hooks/useSeason'
import { surname } from '../../lib/format'
import styles from './Home.module.css'

// Visual order: P2 left, P1 centre, P3 right
const PODIUM_ORDER = [2, 1, 3]

function gapToWinner(r) {
  if (r.position === 1) return 'Winner'
  if (r.time) return r.time.startsWith('+') ? `${r.time}s` : r.time
  return r.status
}

/** Final-lap headline from the rule-based analyst; renders nothing unless it succeeds. */
function AnalystHeadline({ season, round }) {
  const { data } = useQuery({
    queryKey: ['race-analyst', season, String(round)],
    queryFn: () => f1Api.getRaceAnalyst(Number(season), Number(round)),
    retry: false,
    staleTime: 30 * 60 * 1000,
  })
  const headline = data?.insights?.at(-1)?.headline
  if (!headline) return null
  return (
    <div className={styles.analyst}>
      <p className={styles.analystLabel}>Race analyst</p>
      <p className={styles.analystText}>{headline}</p>
    </div>
  )
}

export default function LastRacePanel({ season, results }) {
  const race = results.data
  const podium = race?.results?.filter(r => r.position <= 3) ?? []

  return (
    <section className={styles.card} aria-labelledby="last-race-heading">
      <SectionHeading
        id="last-race-heading"
        title="Last race"
        badge={race?.round ? `Round ${race.round}` : undefined}
      />

      {results.isLoading && (
        <div aria-busy="true" aria-label="Loading last race" className={styles.stack}>
          <Skeleton width="70%" height={16} />
          <Skeleton height={200} />
        </div>
      )}

      {results.isError && <p className={styles.panelMessage}>Last race results aren't available right now.</p>}

      {race && podium.length === 0 && !results.isLoading && (
        <p className={styles.panelMessage}>No race has been run yet in {season}.</p>
      )}

      {podium.length > 0 && (
        <>
          <p className={styles.panelSub}>{race.raceName}, {race.circuitName}</p>
          <ol className={styles.podium} aria-label="Podium">
            {PODIUM_ORDER.map(pos => {
              const r = podium.find(p => p.position === pos)
              if (!r) return null
              return (
                <li key={pos} className={`${styles.podiumCol} ${pos === 1 ? styles.podiumWinner : ''}`}>
                  <DriverImage
                    key={r.driverId}
                    driverId={r.driverId}
                    size={pos === 1 ? 72 : 52}
                    color={r.teamColor}
                    initials={r.code}
                    alt={r.fullName}
                  />
                  <span className={styles.podiumName}>{surname(r)}</span>
                  <span className={styles.podiumGap}>{gapToWinner(r)}</span>
                  <span
                    className={`${styles.step} ${styles[`step${pos}`]}`}
                    style={{ '--team': r.teamColor }}
                  >
                    <span className={styles.stepNum} aria-label={`Position ${pos}`}>{pos}</span>
                  </span>
                </li>
              )
            })}
          </ol>

          <AnalystHeadline season={season} round={race.round} />

          <Link
            to={withSeason('/telemetry', season, { round: race.round })}
            className={styles.button}
          >
            Open race analysis
          </Link>
        </>
      )}
    </section>
  )
}
