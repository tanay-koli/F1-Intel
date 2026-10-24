import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, StatCard, useIsMobile } from '../components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ConstructorImage } from '../components/F1Image'
import SectionHeading from '../components/SectionHeading'
import Podium from '../components/Podium'
import StandingsRow, { StandingsList } from '../components/StandingsRow'
import { points, surname } from '../lib/format'
import styles from './ranked.module.css'

function gapToLeader(standing, leaderPts) {
  return standing.position === 1 ? 'Leader' : `−${points(leaderPts - standing.points)} pts`
}

/* ── Constructor profile panel ─────────────────────────────────────────────── */

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '8px 12px', fontSize: 13
    }}>
      {d.payload.name} · {points(d.value)} pts
    </div>
  )
}

function ConstructorProfile({ standing, season, allStandings, onClose }) {
  const { data } = useQuery({
    queryKey: ['constructor', standing.constructorId, season],
    queryFn: () => f1Api.getConstructor(standing.constructorId, season)
  })

  const color = standing.color || '#e10600'

  return (
    <section className={styles.panel} style={{ '--team': color }} aria-label={`${standing.name} profile`}>
      {onClose && <button type="button" className={styles.close} onClick={onClose}>Close</button>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <ConstructorImage
          constructorId={standing.constructorId}
          width={96}
          height={48}
          color={color}
          name={standing.name}
          alt={`${standing.name} logo`}
        />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 28, lineHeight: 1.05, letterSpacing: '0.02em' }}>
            {standing.name}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            P{standing.position} · {standing.nationality}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <StatCard label="Points" value={points(standing.points)} />
        <StatCard label="Wins"   value={standing.wins} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginBottom: 8 }}>
          Points against the other teams
        </h3>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={allStandings} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickFormatter={n => n.split(' ').map(w => w[0]).join('')}
              axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
            <Bar dataKey="points">
              {allStandings.map(entry => (
                <Cell
                  key={entry.constructorId}
                  fill={entry.constructorId === standing.constructorId ? entry.color : '#343842'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data?.constructor?.url && (
        <a href={data.constructor.url} target="_blank" rel="noopener noreferrer" style={{
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
                    width={96} height={48} color={s.color} name={s.name} alt={`${s.name} logo`} />
                ),
                ...props(s),
              }))}
            />
          )}
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
