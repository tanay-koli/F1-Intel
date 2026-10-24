import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, StatCard, useIsMobile } from '../components/ui'
import DriverMark from '../components/DriverMark'
import SectionHeading from '../components/SectionHeading'
import Podium from '../components/Podium'
import StandingsRow, { StandingsList } from '../components/StandingsRow'
import { ExternalLink } from 'lucide-react'
import { points, surname } from '../lib/format'
import { inkOn } from '../lib/color'
import styles from './ranked.module.css'

function gapToLeader(standing, leaderPts) {
  return standing.position === 1 ? 'Leader' : `−${points(leaderPts - standing.points)} pts`
}

/* ── Driver profile panel ──────────────────────────────────────────────────── */

function DriverProfile({ standing, season, onClose }) {
  const { data } = useQuery({
    queryKey: ['driver', standing.driverId, season],
    queryFn: () => f1Api.getDriver(standing.driverId, season)
  })

  const color = standing.teamColor

  return (
    <section
      className={styles.panel}
      style={color ? { '--team': color, '--ink': inkOn(color) } : undefined}
      aria-label={`${standing.fullName} profile`}
    >
      <div className={styles.panelHead}>
        {standing.number && <span className={styles.panelNumber} aria-hidden="true">{standing.number}</span>}
        <div className={styles.panelText}>
          <h2 className={styles.panelName}>{standing.fullName}</h2>
          <p className={styles.panelMeta}>
            {standing.constructorName}{standing.number ? ` · #${standing.number}` : ''}
          </p>
        </div>
        {onClose && <button type="button" className={styles.close} onClick={onClose}>Close</button>}
      </div>

      <div className={styles.panelBody}>
      <div className={styles.stats}>
        <StatCard label="Points" value={points(standing.points)} />
        <StatCard label="Wins" value={standing.wins} />
        <StatCard label="Position" value={`P${standing.position}`} />
        {data?.driver && (
          <StatCard label="Born" value={data.driver.dateOfBirth?.slice(0, 4)} sub={data.driver.dateOfBirth} />
        )}
      </div>

      {data?.driver?.url && (
        <a href={data.driver.url} target="_blank" rel="noopener noreferrer" className={styles.extLink}>
          Wikipedia <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      </div>
    </section>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function DriversPage({ season }) {
  const isMobile = useIsMobile(900)
  const [selected, setSelected] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['driver-standings', season],
    queryFn: () => f1Api.getDriverStandings(season),
  })

  if (isLoading) return <Loader label="Fetching driver standings..." />
  if (error)     return <ErrorMsg error={error} />

  const standings = data?.standings || []
  const podium    = standings.filter(s => s.position <= 3).sort((a, b) => a.position - b.position)
  const rest      = standings.filter(s => s.position > 3)
  const leaderPts = standings[0]?.points ?? 0

  const toggle = (s) => setSelected(prev => prev?.driverId === s.driverId ? null : s)
  // Wide screens always show a profile (the leader until a row is picked); phones only on demand.
  const profile = selected ?? (isMobile ? null : standings[0])

  const props = (s) => ({
    position: s.position,
    color: s.teamColor,
    subline: s.constructorName,
    figure: points(s.points),
    unit: 'pts',
    detail: gapToLeader(s, leaderPts),
    onClick: () => toggle(s),
    selected: profile?.driverId === s.driverId,
  })

  return (
    <div>
      <header className={styles.header}>
        <div>
          <SectionHeading as="h1" title="Driver standings" badge={data?.round ? `Round ${data.round}` : season} />
          <p className={styles.sub}>{standings.length} drivers · {season} season</p>
        </div>
      </header>

      <div className={styles.layout}>
        <div>
          {podium.length > 0 && (
            <Podium
              label="Top three"
              items={podium.map(s => ({ key: s.driverId, name: surname(s), ...props(s) }))}
            />
          )}
          <div className={styles.table}>
          <StandingsList>
            {rest.map(s => (
              <StandingsRow
                key={s.driverId}
                image={<DriverMark driver={s} />}
                name={s.fullName}
                share={leaderPts ? s.points / leaderPts : 0}
                {...props(s)}
              />
            ))}
          </StandingsList>
          </div>
        </div>

        {profile && (
          <aside className={styles.aside}>
            <DriverProfile
              key={profile.driverId}
              standing={profile}
              season={season}
              onClose={selected ? () => setSelected(null) : undefined}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
