import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, StatCard, useIsMobile } from '../components/ui'
import { DriverImage } from '../components/F1Image'
import SectionHeading from '../components/SectionHeading'
import Podium from '../components/Podium'
import StandingsRow, { StandingsList } from '../components/StandingsRow'
import { points, surname } from '../lib/format'
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

  const color = standing.teamColor || '#e10600'

  return (
    <section className={styles.panel} style={{ '--team': color }} aria-label={`${standing.fullName} profile`}>
      {onClose && <button type="button" className={styles.close} onClick={onClose}>Close</button>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <DriverImage
          driverId={standing.driverId}
          size={80}
          color={color}
          initials={standing.code || standing.fullName?.slice(0, 3).toUpperCase()}
          alt={standing.fullName}
        />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 28, lineHeight: 1.05, letterSpacing: '0.02em' }}>
            {standing.fullName}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {standing.constructorName}{standing.number ? ` · #${standing.number}` : ''}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatCard label="Points" value={points(standing.points)} />
        <StatCard label="Wins" value={standing.wins} />
        <StatCard label="Position" value={`P${standing.position}`} />
        {data?.driver && (
          <StatCard label="Born" value={data.driver.dateOfBirth?.slice(0, 4)} sub={data.driver.dateOfBirth} />
        )}
      </div>

      {data?.driver?.url && (
        <a href={data.driver.url} target="_blank" rel="noopener noreferrer" style={{
          fontSize: 13, color: 'var(--text-muted)',
          textDecoration: 'underline', textUnderlineOffset: 4,
        }}>
          Wikipedia ↗
        </a>
      )}
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
    image: (
      <DriverImage
        key={s.driverId}
        driverId={s.driverId}
        size={s.position <= 3 ? 72 : 40}
        color={s.teamColor}
        initials={s.code || s.fullName?.slice(0, 3).toUpperCase()}
        alt={s.fullName}
      />
    ),
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
          <StandingsList>
            {rest.map(s => (
              <StandingsRow
                key={s.driverId}
                name={s.fullName}
                share={leaderPts ? s.points / leaderPts : 0}
                {...props(s)}
              />
            ))}
          </StandingsList>
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
