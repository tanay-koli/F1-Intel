import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, StatCard, useIsMobile } from '../components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ConstructorImage } from '../components/F1Image'
import SectionHeading from '../components/SectionHeading'
import Podium from '../components/Podium'
import StandingsRow, { StandingsList } from '../components/StandingsRow'
import { ExternalLink } from 'lucide-react'
import { points, surname } from '../lib/format'
import { inkOn } from '../lib/color'
import styles from './ranked.module.css'
import chart from '../components/chart.module.css'
import { MUTED_SERIES, TICK } from '../lib/chartTheme'

function gapToLeader(standing, leaderPts) {
  return standing.position === 1 ? 'Leader' : `−${points(leaderPts - standing.points)} pts`
}

/* ── Constructor profile panel ─────────────────────────────────────────────── */

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className={chart.tooltip}>
      {d.payload.name} · {points(d.value)} pts
    </div>
  )
}

function ConstructorProfile({ standing, season, allStandings, onClose }) {
  const { data } = useQuery({
    queryKey: ['constructor', standing.constructorId, season],
    queryFn: () => f1Api.getConstructor(standing.constructorId, season)
  })

  const color = standing.color

  return (
    <section
      className={styles.panel}
      style={color ? { '--team': color, '--ink': inkOn(color) } : undefined}
      aria-label={`${standing.name} profile`}
    >
      <div className={styles.panelHead}>
        <ConstructorImage
          constructorId={standing.constructorId}
          width={56}
          height={56}
          color={color}
          name={standing.name}
          alt={`${standing.name} logo`}
        />
        <div className={styles.panelText}>
          <h2 className={styles.panelName}>{standing.name}</h2>
          <p className={styles.panelMeta}>P{standing.position} · {standing.nationality}</p>
        </div>
        {onClose && <button type="button" className={styles.close} onClick={onClose}>Close</button>}
      </div>

      <div className={styles.panelBody}>
      <div className={styles.stats}>
        <StatCard label="Points" value={points(standing.points)} />
        <StatCard label="Wins"   value={standing.wins} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <h3 className={styles.chartLabel}>
          Points against the other teams
        </h3>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={allStandings} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: TICK }}
              tickFormatter={n => n.split(' ').map(w => w[0]).join('')}
              axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
            <Bar dataKey="points">
              {allStandings.map(entry => (
                <Cell
                  key={entry.constructorId}
                  fill={entry.constructorId === standing.constructorId ? entry.color : MUTED_SERIES}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data?.constructor?.url && (
        <a href={data.constructor.url} target="_blank" rel="noopener noreferrer" className={styles.extLink}>
          Wikipedia <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      </div>
    </section>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function ConstructorsPage({ season }) {
  const isMobile = useIsMobile(900)
  const [selected, setSelected] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['constructor-standings', season],
    queryFn: () => f1Api.getConstructorStandings(season),
  })
  // Same key as the drivers page and Home, so it's usually cached already.
  const { data: drivers } = useQuery({
    queryKey: ['driver-standings', season],
    queryFn: () => f1Api.getDriverStandings(season),
  })

  if (isLoading) return <Loader label="Fetching constructor standings..." />
  if (error)     return <ErrorMsg error={error} />

  const standings = data?.standings || []
  const podium    = standings.filter(s => s.position <= 3).sort((a, b) => a.position - b.position)
  const rest      = standings.filter(s => s.position > 3)
  const leaderPts = standings[0]?.points ?? 0

  const driverNames = (constructorId) =>
    (drivers?.standings ?? []).filter(d => d.constructorId === constructorId).map(surname).join(' · ')

  const toggle = (s) => setSelected(prev => prev?.constructorId === s.constructorId ? null : s)
  // Wide screens always show a profile (the leader until a row is picked); phones only on demand.
  const profile = selected ?? (isMobile ? null : standings[0])

  const props = (s) => ({
    position: s.position,
    color: s.color,
    name: s.name,
    subline: driverNames(s.constructorId) || s.nationality,
    figure: points(s.points),
    unit: 'pts',
    detail: gapToLeader(s, leaderPts),
    onClick: () => toggle(s),
    selected: profile?.constructorId === s.constructorId,
  })

  return (
    <div>
      <header className={styles.header}>
        <div>
          <SectionHeading as="h1" title="Constructor standings" badge={data?.round ? `Round ${data.round}` : season} />
          <p className={styles.sub}>{standings.length} teams · {season} season</p>
        </div>
      </header>

      <div className={styles.layout}>
        <div>
          {podium.length > 0 && (
            <Podium
              label="Top three"
              items={podium.map(s => ({
                key: s.constructorId,
                image: (
                  <ConstructorImage key={s.constructorId} constructorId={s.constructorId}
                    width={64} height={64} color={s.color} name={s.name} alt={`${s.name} logo`} />
                ),
                ...props(s),
              }))}
            />
          )}
          <div className={styles.table}>
          <StandingsList>
            {rest.map(s => (
              <StandingsRow
                key={s.constructorId}
                image={
                  <ConstructorImage key={s.constructorId} constructorId={s.constructorId}
                    width={40} height={40} color={s.color} name={s.name} alt={`${s.name} logo`} />
                }
                share={leaderPts ? s.points / leaderPts : 0}
                {...props(s)}
              />
            ))}
          </StandingsList>
          </div>
        </div>

        {profile && (
          <aside className={styles.aside}>
            <ConstructorProfile
              key={profile.constructorId}
              standing={profile}
              season={season}
              allStandings={standings}
              onClose={selected ? () => setSelected(null) : undefined}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
