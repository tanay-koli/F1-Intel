import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, useIsMobile } from '../components/ui'
import { DriverImage, ConstructorImage } from '../components/F1Image'
import SectionHeading from '../components/SectionHeading'
import { shortGpName, surname } from '../lib/format'

/* ── helpers ───────────────────────────────────────────────────────────────── */

const FALLBACK_1 = '#e10600'
const FALLBACK_2 = '#3671C6'
// Teammates share a team colour, so the second side switches to the ink colour.
const SECOND_WHEN_SAME = '#E8EBEF'

/** One colour per side, never the same twice. */
function sideColors(d1, d2) {
  const c1 = d1?.teamColor || FALLBACK_1
  const c2 = d2?.teamColor || FALLBACK_2
  return [c1, c2.toLowerCase() === c1.toLowerCase() ? SECOND_WHEN_SAME : c2]
}

const isNumeric = text => /^\d+$/.test(String(text))

const STAT_DEFS = [
  { key: 'totalPoints',      label: 'Total points' },
  { key: 'points',           label: 'Race points' },
  { key: 'sprintPoints',     label: 'Sprint points' },
  { key: 'wins',             label: 'Wins' },
  { key: 'podiums',          label: 'Podiums' },
  { key: 'headToHeadWins',   label: 'Finished ahead' },
  { key: 'qualiWins',        label: 'Qualified ahead' },
  { key: 'fastestLaps',      label: 'Fastest laps' },
  { key: 'avgPosition',      label: 'Average finish',     lowerBetter: true, decimals: 1 },
  { key: 'avgQualiPosition', label: 'Average qualifying', lowerBetter: true, decimals: 1 },
  { key: 'dnf',              label: 'Retirements',        lowerBetter: true },
  { key: 'races',            label: 'Races' },
]

const selectStyle = {
  width: '100%', minHeight: 40,
  background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
  borderRadius: 8, color: 'var(--text)',
  padding: '0 32px 0 12px',
  fontFamily: 'var(--body)', fontSize: 14,
  cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23A3ABB6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
}

/* ── Driver picker ─────────────────────────────────────────────────────────── */

function Picker({ label, value, onChange, options, noun }) {
  return (
    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        <option value="">Select a {noun}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  )
}

/* ── Stat comparison ───────────────────────────────────────────────────────── */

function StatRow({ stat, d1, d2, c1, c2, isMobile }) {
  const v1 = d1?.[stat.key] ?? 0
  const v2 = d2?.[stat.key] ?? 0
  const d1Wins = stat.lowerBetter ? v1 < v2 : v1 > v2
  const d2Wins = stat.lowerBetter ? v2 < v1 : v2 > v1
  const fmt = v => (stat.decimals ? Number(v).toFixed(stat.decimals) : v)
  const value = (v, wins, color, align) => (
    <span style={{
      textAlign: align, fontFamily: 'var(--display)', fontSize: isMobile ? 22 : 28, lineHeight: 1,
      color: wins ? color : 'var(--text-muted)',
    }}>
      {fmt(v)}
    </span>
  )

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
      gap: isMobile ? 8 : 16, padding: '10px 0', borderBottom: '1px solid var(--border)',
    }}>
      {value(v1, d1Wins, c1, 'right')}
      <span style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', minWidth: isMobile ? 96 : 140 }}>
        {stat.label}
      </span>
      {value(v2, d2Wins, c2, 'left')}
    </div>
  )
}

/* ── H2H split bars ────────────────────────────────────────────────────────── */

function H2HBar({ d1, d2, c1, c2, valueKey, label }) {
  if (!d1 || !d2) return null
  const n1 = d1[valueKey] ?? 0
  const n2 = d2[valueKey] ?? 0
  if (n1 + n2 === 0) return null

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: 18, letterSpacing: '0.02em' }}>
          {d1.code} <span style={{ color: c1 }}>{n1}</span>
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--display)', fontSize: 18, letterSpacing: '0.02em' }}>
          <span style={{ color: c2 }}>{n2}</span> {d2.code}
        </span>
      </div>
      <div style={{ height: 8, display: 'flex', gap: 2 }} role="img" aria-label={`${label}: ${d1.code} ${n1}, ${d2.code} ${n2}`}>
        {n1 > 0 && <div style={{ flex: n1, background: c1, borderRadius: 4 }} />}
        {n2 > 0 && <div style={{ flex: n2, background: c2, borderRadius: 4 }} />}
      </div>
    </div>
  )
}

/* ── Race log table ────────────────────────────────────────────────────────── */

const LOG_COLUMNS = { desktop: '48px minmax(0, 1.4fr) 1fr 1fr', mobile: 'minmax(0, 1fr) 1fr 1fr' }

function Tag({ children, strong, color }) {
  return (
    <span style={{
      flex: 'none', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 400, borderRadius: 4, padding: '0 6px',
      background: 'var(--bg-card)', border: `1px solid ${strong ? color : 'var(--border-strong)'}`,
      color: strong ? 'var(--text)' : 'var(--text-muted)',
    }}>
      {children}
    </span>
  )
}

/** A side's cell: the result (bold, with a mark in the side's colour, when it won the round), then its tags. */
function Cell({ isWinner, color, children }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4,
      fontSize: 13, color: isWinner ? 'var(--text)' : 'var(--text-muted)', fontWeight: isWinner ? 700 : 400,
    }}>
      {isWinner && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: 'none' }} />}
      {children}
    </div>
  )
}

function RaceLogRow({ race, driver1Id, driver2Id, c1, c2, isMobile }) {
  const { d1, d2, winner, sprint, quali } = race
  const q1 = quali?.d1
  const q2 = quali?.d2
  // who out-qualified whom this round?
  const d1OutQuali = q1 && q2 && q1.position < q2.position
  const d2OutQuali = q1 && q2 && q2.position < q1.position

  const side = (r, sp, q, outQuali, isWinner, color) => (
    <Cell isWinner={isWinner} color={color}>
      {!r ? '—' : isNumeric(r.positionText) ? `P${r.position}` : r.positionText}
      {r?.points > 0 && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>+{r.points}</span>}
      {sp?.points > 0 && <Tag>Sprint +{sp.points}</Tag>}
      {q?.position && q.position < 99 && <Tag strong={outQuali} color={color}>Quali P{q.position}</Tag>}
    </Cell>
  )

  return (
    <LogRow race={race} isMobile={isMobile}>
      {side(d1, sprint?.d1, q1, d1OutQuali, winner === driver1Id, c1)}
      {side(d2, sprint?.d2, q2, d2OutQuali, winner === driver2Id, c2)}
    </LogRow>
  )
}

/** One race-log row: round, race name, then the two sides. */
function LogRow({ race, isMobile, children }) {
  return (
    <li style={{
      display: 'grid', gridTemplateColumns: isMobile ? LOG_COLUMNS.mobile : LOG_COLUMNS.desktop,
      alignItems: 'center', gap: 12, padding: isMobile ? '10px 12px' : '10px 16px',
      borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    }}>
      {!isMobile && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>R{race.round}</span>}
      <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isMobile ? shortGpName(race.raceName) : race.raceName}
      </span>
      {children}
    </li>
  )
}

/** Constructor race-log row: each team's cars (best first) and its points that round. */
function ConstructorRaceRow({ race, c1Id, c1, c2, isMobile }) {
  const isC1Win = race.winner === c1Id
  const isC2Win = !!race.winner && !isC1Win
  const cell = (side, isWinner, color) => (
    <Cell isWinner={isWinner} color={color}>
      {side
        ? side.cars.map(c => isNumeric(c.positionText) ? `P${c.position}` : c.positionText).join(' · ')
        : '—'}
      {side?.points > 0 && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>+{side.points}</span>}
    </Cell>
  )
  return (
    <LogRow race={race} isMobile={isMobile}>
      {cell(race.c1, isC1Win, c1)}
      {cell(race.c2, isC2Win, c2)}
    </LogRow>
  )
}

/* ── Hero card per side ────────────────────────────────────────────────────── */

function DriverHero({ driver, color, side, isMobile, isTeams }) {
  if (!driver?.fullName) return <div />
  const right = side === 'right'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, flexDirection: right ? 'row-reverse' : 'row',
      padding: isMobile ? 12 : '16px 20px', minWidth: 0,
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderTop: `3px solid ${color}`, borderRadius: 8,
    }}>
      {isTeams ? (
        <ConstructorImage constructorId={driver.constructorId} width={isMobile ? 40 : 72} height={isMobile ? 40 : 48}
          color={driver.teamColor} name={driver.fullName} alt={`${driver.fullName} logo`} />
      ) : (
        <DriverImage driverId={driver.driverId} size={isMobile ? 40 : 64} color={driver.teamColor}
          initials={driver.code} alt={driver.fullName} />
      )}
      <div style={{ minWidth: 0, textAlign: right ? 'right' : 'left' }}>
        <div style={{
          fontFamily: 'var(--display)', fontSize: isMobile ? 20 : 26, letterSpacing: '0.03em', lineHeight: 1.05,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {isMobile && !isTeams ? surname(driver) : driver.fullName}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {driver.constructorName}
        </div>
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

const MODES = {
  drivers: {
    noun: 'driver',
    standingsKey: 'driver-standings',
    getStandings: f1Api.getDriverStandings,
    option: s => ({ id: s.driverId, label: `${s.fullName} (${s.constructorName})` }),
    getH2H: f1Api.getH2H,
  },
  constructors: {
    noun: 'constructor',
    standingsKey: 'constructor-standings',
    getStandings: f1Api.getConstructorStandings,
    option: s => ({ id: s.constructorId, label: s.name }),
    getH2H: f1Api.getConstructorH2H,
  },
}

// A team summary in the shape DriverHero / StatRow expect (same stat keys)
const asHero = c => c && {
  ...c,
  fullName: c.name,
  code: c.name.slice(0, 3).toUpperCase(),
  teamColor: c.color,
  constructorName: c.drivers.join(' · '),
}

export default function H2HPage({ season }) {
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const modeKey = searchParams.get('mode') === 'constructors' ? 'constructors' : 'drivers'
  const mode = MODES[modeKey]
  // null = not picked: default to P1 vs P2 in the championship
  const [picks, setPicks] = useState({ drivers: [null, null], constructors: [null, null] })

  const setMode = (next) => setSearchParams(prev => {
    const p = new URLSearchParams(prev)
    if (next === 'constructors') p.set('mode', next)
    else p.delete('mode')
    return p
  })

  const { data: standingsData } = useQuery({
    queryKey: [mode.standingsKey, season],
    queryFn:  () => mode.getStandings(season),
  })
  const options = (standingsData?.standings || []).map(mode.option)
  const [pick1, pick2] = picks[modeKey]
  const id1 = pick1 ?? options[0]?.id ?? ''
  const id2 = pick2 ?? options[1]?.id ?? ''
  const setPick = (i) => (value) =>
    setPicks(prev => ({ ...prev, [modeKey]: prev[modeKey].map((v, j) => (j === i ? value : v)) }))

  const canLoad = Boolean(id1 && id2 && id1 !== id2)

  const { data, isLoading, error } = useQuery({
    queryKey: ['h2h', modeKey, season, id1, id2],
    queryFn:  () => mode.getH2H(season, id1, id2),
    enabled:  canLoad,
  })

  const isTeams = modeKey === 'constructors'
  const d1 = isTeams ? asHero(data?.constructor1) : data?.driver1
  const d2 = isTeams ? asHero(data?.constructor2) : data?.driver2
  const races = data?.races || []
  const [c1, c2] = sideColors(d1, d2)

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <SectionHeading as="h1" title="Head to head" badge={season} />
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: -8 }}>
          Compare two {mode.noun}s across the season: stats, records and every race.
        </p>
      </header>

      {/* Drivers | Constructors */}
      <div role="group" aria-label="Compare" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {Object.entries(MODES).map(([key, m]) => (
          <button
            key={key}
            type="button"
            id={`h2h-mode-${key}`}
            aria-pressed={modeKey === key}
            onClick={() => setMode(key)}
            style={{
              minHeight: 36, padding: '0 16px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'var(--body)', fontSize: 14,
              background: modeKey === key ? 'var(--pill-active)' : 'transparent',
              color: modeKey === key ? 'var(--text)' : 'var(--text-muted)',
            }}
          >
            {m.noun[0].toUpperCase() + m.noun.slice(1)}s
          </button>
        ))}
      </div>

      {/* Pickers */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24,
        flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-end',
      }}>
        <Picker label={`First ${mode.noun}`} value={id1} onChange={setPick(0)} options={options} noun={mode.noun} />
        {!isMobile && <span style={{ fontSize: 14, color: 'var(--text-muted)', paddingBottom: 10 }}>vs</span>}
        <Picker label={`Second ${mode.noun}`} value={id2} onChange={setPick(1)} options={options} noun={mode.noun} />
      </div>

      {!canLoad && !isLoading && (
        <p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Select two different {mode.noun}s to compare them.
        </p>
      )}

      {isLoading && <Loader label="Computing head-to-head stats..." />}
      {error && <ErrorMsg error={error} />}

      {data && !isLoading && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12, marginBottom: 20 }}>
            <DriverHero driver={d1} color={c1} side="left"  isMobile={isMobile} isTeams={isTeams} />
            <DriverHero driver={d2} color={c2} side="right" isMobile={isMobile} isTeams={isTeams} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <H2HBar d1={d1} d2={d2} c1={c1} c2={c2} valueKey="headToHeadWins" label="Finished ahead" />
            <H2HBar d1={d1} d2={d2} c1={c1} c2={c2} valueKey="qualiWins"      label="Qualified ahead" />
          </div>

          <section aria-label="Season stats" style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: isMobile ? '12px 14px' : '16px 24px',
            marginBottom: 32,
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: isMobile ? 8 : 16,
              paddingBottom: 8, borderBottom: '1px solid var(--border-strong)',
              fontFamily: 'var(--display)', fontSize: 16, letterSpacing: '0.03em',
            }}>
              <span style={{ textAlign: 'right' }}>{d1?.code || '—'}</span>
              <span style={{ minWidth: isMobile ? 96 : 140 }} />
              <span>{d2?.code || '—'}</span>
            </div>
            {STAT_DEFS.map(stat => (
              <StatRow key={stat.key} stat={stat} d1={d1} d2={d2} c1={c1} c2={c2} isMobile={isMobile} />
            ))}
          </section>

          {races.length > 0 && (
            <section aria-labelledby="race-log-heading">
              <h2 id="race-log-heading" style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Race by race</h2>

              <div aria-hidden="true" style={{
                display: 'grid', gridTemplateColumns: isMobile ? LOG_COLUMNS.mobile : LOG_COLUMNS.desktop,
                gap: 12, padding: isMobile ? '0 12px 6px' : '0 16px 8px', fontSize: 12, color: 'var(--text-muted)',
              }}>
                {!isMobile && <span>Round</span>}
                <span>Race</span>
                <span>{d1?.code || 'First'}</span>
                <span>{d2?.code || 'Second'}</span>
              </div>

              <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {races.map((race, idx) => {
                  if (!race) return null
                  return isTeams ? (
                    <ConstructorRaceRow key={race.round || idx} race={race} c1Id={id1} c1={c1} c2={c2} isMobile={isMobile} />
                  ) : (
                    <RaceLogRow key={race.round || idx} race={race} driver1Id={id1} driver2Id={id2} c1={c1} c2={c2} isMobile={isMobile} />
                  )
                })}
              </ol>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
