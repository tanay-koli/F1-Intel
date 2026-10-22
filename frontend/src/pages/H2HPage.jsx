import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, TeamDot, useIsMobile } from '../components/ui'

/* ── helpers ───────────────────────────────────────────────────────────────── */

function hex2rgba(hex, alpha) {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  } catch { return hex }
}

const STAT_DEFS = [
  { key: 'totalPoints',      label: 'Total Points',    icon: '🏆' },
  { key: 'points',           label: 'Race Points',     icon: '🎯' },
  { key: 'sprintPoints',     label: 'Sprint Points',   icon: '🏃' },
  { key: 'wins',             label: 'Wins',            icon: '🥇' },
  { key: 'podiums',          label: 'Podiums',         icon: '🏅' },
  { key: 'headToHeadWins',   label: 'H2H Record',      icon: '⚔️' },
  { key: 'qualiWins',        label: 'Quali H2H',       icon: '🚦' },
  { key: 'fastestLaps',      label: 'Fastest Laps',    icon: '⚡' },
  { key: 'avgPosition',      label: 'Avg Race Finish', icon: '📊', lowerBetter: true },
  { key: 'avgQualiPosition', label: 'Avg Quali Pos',   icon: '📡', lowerBetter: true },
  { key: 'dnf',              label: 'DNFs',            icon: '❌', lowerBetter: true },
  { key: 'races',            label: 'Races',           icon: '🏁' },
]

/* ── Driver picker ─────────────────────────────────────────────────────────── */

function Picker({ label, value, onChange, options, noun }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text)',
          padding: '10px 32px 10px 12px',
          fontFamily: 'var(--mono)', fontSize: 13,
          cursor: 'pointer', outline: 'none', appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b6b7a'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
        }}
      >
        <option value="">— Select {noun} —</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  )
}

/* ── Stat comparison card ──────────────────────────────────────────────────── */

function StatRow({ stat, d1, d2, isMobile }) {
  const v1 = d1?.[stat.key] ?? 0
  const v2 = d2?.[stat.key] ?? 0
  const d1Wins = stat.lowerBetter ? v1 < v2 : v1 > v2
  const d2Wins = stat.lowerBetter ? v2 < v1 : v2 > v1
  const c1 = d1?.teamColor || '#e10600'
  const c2 = d2?.teamColor || '#3671C6'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: isMobile ? 8 : 16,
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* D1 value */}
      <div style={{ textAlign: 'right' }}>
        <span style={{
          fontFamily: 'var(--display)',
          fontSize: isMobile ? 22 : 28,
          color: d1Wins ? c1 : 'var(--text)',
          lineHeight: 1,
          textShadow: d1Wins ? `0 0 20px ${c1}60` : 'none',
        }}>
          {stat.key === 'avgPosition' ? v1.toFixed(1) : v1}
        </span>
      </div>

      {/* Label centre */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: isMobile ? 14 : 18, marginBottom: 2 }}>{stat.icon}</div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: isMobile ? 8 : 10,
          color: 'var(--text-muted)', letterSpacing: '0.08em', whiteSpace: 'nowrap',
        }}>
          {stat.label}
        </div>
      </div>

      {/* D2 value */}
      <div style={{ textAlign: 'left' }}>
        <span style={{
          fontFamily: 'var(--display)',
          fontSize: isMobile ? 22 : 28,
          color: d2Wins ? c2 : 'var(--text)',
          lineHeight: 1,
          textShadow: d2Wins ? `0 0 20px ${c2}60` : 'none',
        }}>
          {stat.key === 'avgPosition' ? v2.toFixed(1) : v2}
        </span>
      </div>
    </div>
  )
}

/* ── H2H progress bars ─────────────────────────────────────────────────────── */

function H2HBar({ d1, d2, valueKey, label }) {
  if (!d1 || !d2) return null
  const total = (d1[valueKey] ?? 0) + (d2[valueKey] ?? 0)
  if (total === 0) return null
  const pct1 = ((d1[valueKey] ?? 0) / total) * 100
  const c1 = d1.teamColor || '#e10600'
  const c2 = d2.teamColor || '#3671C6'

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
        <span style={{ color: c1, fontFamily: 'var(--display)', fontSize: 14 }}>
          {d1.code} · {d1[valueKey] ?? 0}
        </span>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 10 }}>
          {label}
        </span>
        <span style={{ color: c2, fontFamily: 'var(--display)', fontSize: 14 }}>
          {d2[valueKey] ?? 0} · {d2.code}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${pct1}%`, background: c1, transition: 'width 0.6s ease' }} />
        <div style={{ flex: 1, background: c2 }} />
      </div>
    </div>
  )
}

/* ── Race log table ────────────────────────────────────────────────────────── */

function SprintBadge({ pts, color }) {
  if (!pts || pts <= 0) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 9, fontFamily: 'var(--mono)',
      background: `${color}22`, border: `1px solid ${color}55`,
      color: color, borderRadius: 4, padding: '1px 5px',
      marginLeft: 4, verticalAlign: 'middle',
    }}>
      🏃+{pts}
    </span>
  )
}

function QualiBadge({ pos, outQualified, color }) {
  if (!pos || pos >= 99) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 9, fontFamily: 'var(--mono)',
      background: outQualified ? `${color}25` : 'var(--bg-elevated)',
      border: `1px solid ${outQualified ? color : 'var(--border)'}`,
      color: outQualified ? color : 'var(--text-dim)',
      borderRadius: 4, padding: '1px 5px',
      marginLeft: 4, verticalAlign: 'middle',
    }}>
      Q{pos}
    </span>
  )
}

function RaceLogRow({ race, driver1Id, driver2Id, d1Color, d2Color, isMobile }) {
  const { d1, d2, winner, sprint, quali } = race
  const isD1Win = winner === driver1Id
  const isD2Win = winner === driver2Id
  const sp1 = sprint?.d1
  const sp2 = sprint?.d2
  const q1 = quali?.d1
  const q2 = quali?.d2
  // who out-qualified whom this round?
  const d1OutQuali = q1 && q2 && q1.position < q2.position
  const d2OutQuali = q1 && q2 && q2.position < q1.position

  function cellStyle(isWinner, color) {
    return {
      fontFamily: 'var(--mono)', fontSize: isMobile ? 10 : 12,
      color: isWinner ? color : 'var(--text-muted)',
      fontWeight: isWinner ? 700 : 400,
    }
  }

  const posLabel = (r) => {
    if (!r) return '—'
    if (!String(r.positionText).match(/^\d+$/)) return r.positionText
    return `P${r.position}`
  }

  const ptsLabel = (r) => {
    if (!r || r.points === undefined) return ''
    return r.points > 0 ? `+${r.points}` : ''
  }

  return (
    <LogRow race={race} winnerColor={isD1Win ? d1Color : isD2Win ? d2Color : null} isMobile={isMobile}>
      <div style={cellStyle(isD1Win, d1Color)}>
        {posLabel(d1)}
        {ptsLabel(d1) && <span style={{ opacity: 0.6, marginLeft: 4 }}>({ptsLabel(d1)})</span>}
        <SprintBadge pts={sp1?.points} color={d1Color} />
        <QualiBadge pos={q1?.position} outQualified={d1OutQuali} color={d1Color} />
      </div>
      <div style={cellStyle(isD2Win, d2Color)}>
        {posLabel(d2)}
        {ptsLabel(d2) && <span style={{ opacity: 0.6, marginLeft: 4 }}>({ptsLabel(d2)})</span>}
        <SprintBadge pts={sp2?.points} color={d2Color} />
        <QualiBadge pos={q2?.position} outQualified={d2OutQuali} color={d2Color} />
      </div>
    </LogRow>
  )
}

/** One race-log row: round, race name, then the two sides; tinted with the winner's colour. */
function LogRow({ race, winnerColor, isMobile, children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '28px 1fr 1fr 1fr' : '36px 1fr 1fr 1fr',
      alignItems: 'center',
      gap: isMobile ? 6 : 12,
      padding: isMobile ? '8px 10px' : '10px 16px',
      borderRadius: 8,
      background: winnerColor ? hex2rgba(winnerColor, 0.07) : 'var(--bg-card)',
      border: `1px solid ${winnerColor ? hex2rgba(winnerColor, 0.25) : 'var(--border)'}`,
      marginBottom: 4,
      animation: 'fadeUp 0.3s ease',
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)' }}>
        R{race.round}
      </span>
      <span style={{ fontSize: isMobile ? 10 : 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {race.raceName.replace(' Grand Prix', isMobile ? ' GP' : ' Grand Prix')}
      </span>
      {children}
    </div>
  )
}

/** Constructor race-log row: each team's cars (best first) and its points that round. */
function ConstructorRaceRow({ race, c1Id, c1Color, c2Color, isMobile }) {
  const isC1Win = race.winner === c1Id
  const isC2Win = !!race.winner && !isC1Win
  const cell = (side, isWinner, color) => (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: isMobile ? 10 : 12,
      color: isWinner ? color : 'var(--text-muted)', fontWeight: isWinner ? 700 : 400,
    }}>
      {side
        ? side.cars.map(c => /^\d+$/.test(c.positionText) ? `P${c.position}` : c.positionText).join(' · ')
        : '—'}
      {side?.points > 0 && <span style={{ opacity: 0.6, marginLeft: 4 }}>(+{side.points})</span>}
    </div>
  )
  return (
    <LogRow race={race} winnerColor={isC1Win ? c1Color : isC2Win ? c2Color : null} isMobile={isMobile}>
      {cell(race.c1, isC1Win, c1Color)}
      {cell(race.c2, isC2Win, c2Color)}
    </LogRow>
  )
}

/* ── Driver hero ────────────────────────────────────────────────────────────── */

function DriverHero({ driver, side, isMobile }) {
  if (!driver?.fullName) return <div style={{ flex: 1 }} />
  const color = driver.teamColor || '#e10600'
  const align = side === 'left' ? 'flex-start' : 'flex-end'
  const textAlign = side === 'left' ? 'left' : 'right'

  return (
    <div style={{
      flex: 1,
      display: 'flex', flexDirection: 'column',
      alignItems: align,
      padding: isMobile ? '16px 14px' : '20px 24px',
      background: `linear-gradient(${side === 'left' ? '135deg' : '225deg'}, ${hex2rgba(color, 0.18)}, #111114 55%)`,
      border: `1px solid ${color}40`,
      borderRadius: 12,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Watermark */}
      <div style={{
        position: 'absolute',
        [side === 'left' ? 'right' : 'left']: -10,
        top: -10,
        fontFamily: 'var(--display)', fontSize: isMobile ? 80 : 120,
        color: hex2rgba(color, 0.08), letterSpacing: '-0.02em',
        userSelect: 'none', pointerEvents: 'none', lineHeight: 1,
      }}>
        {driver.code}
      </div>

      <div style={{ fontSize: 22, marginBottom: 4 }}>{driver.flag}</div>
      <div style={{
        fontFamily: 'var(--display)', fontSize: isMobile ? 18 : 26,
        letterSpacing: '0.04em', textAlign,
      }}>
        {isMobile ? driver.code : driver.fullName.toUpperCase()}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <TeamDot color={color} size={7} />
        <span style={{ fontSize: 11, color: hex2rgba('#fff', 0.5) }}>{driver.constructorName}</span>
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

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 4, height: 28, background: 'var(--red)', borderRadius: 2 }} />
          <h2 style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 24 : 32, letterSpacing: '0.06em' }}>
            HEAD TO HEAD
          </h2>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            padding: '2px 8px', borderRadius: 4,
          }}>{season}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 14 }}>
          Compare two {mode.noun}s across the full season — stats, records, race by race
        </p>
      </div>

      {/* Drivers | Constructors */}
      <div role="group" aria-label="Compare" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {Object.entries(MODES).map(([key, m]) => (
          <button
            key={key}
            id={`h2h-mode-${key}`}
            aria-pressed={modeKey === key}
            onClick={() => setMode(key)}
            style={{
              padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
              fontFamily: 'var(--body)', fontSize: 13, fontWeight: modeKey === key ? 600 : 400,
              background: modeKey === key ? 'var(--pill-active)' : 'transparent',
              border: `1px solid ${modeKey === key ? 'var(--border-strong)' : 'var(--border)'}`,
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
        flexDirection: isMobile ? 'column' : 'row', alignItems: 'flex-end',
      }}>
        <Picker label={`${mode.noun.toUpperCase()} 1`} value={id1} onChange={setPick(0)} options={options} noun={mode.noun} />
        <div style={{
          fontFamily: 'var(--display)', fontSize: 20, color: 'var(--text-muted)',
          paddingBottom: isMobile ? 0 : 10,
        }}>VS</div>
        <Picker label={`${mode.noun.toUpperCase()} 2`} value={id2} onChange={setPick(1)} options={options} noun={mode.noun} />
      </div>

      {/* Empty state */}
      {!canLoad && !isLoading && (
        <div style={{
          textAlign: 'center', padding: isMobile ? '40px 20px' : '60px 20px',
          color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 13,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚔️</div>
          <div>Select two different {mode.noun}s to begin the comparison</div>
        </div>
      )}

      {isLoading && <Loader label="Computing head-to-head stats..." />}
      {error && <ErrorMsg error={error} />}

      {data && !isLoading && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          {/* Driver heroes */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 20,
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            <DriverHero driver={d1} side="left"  isMobile={isMobile} />
            <DriverHero driver={d2} side="right" isMobile={isMobile} />
          </div>

          {/* H2H bars */}
          <div style={{ marginBottom: 24 }}>
            <H2HBar d1={d1} d2={d2} valueKey="headToHeadWins" label="RACE H2H" />
            <H2HBar d1={d1} d2={d2} valueKey="qualiWins"      label="QUALI H2H" />
          </div>

          {/* Stats comparison */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: isMobile ? '16px 14px' : '20px 24px',
            marginBottom: 24,
          }}>
            {/* Column headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: isMobile ? 8 : 16,
              marginBottom: 4,
              paddingBottom: 8,
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontFamily: 'var(--display)', fontSize: 14, color: d1?.teamColor }}>
                  {d1?.code || '—'}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-dim)', textAlign: 'center' }}>
                STAT
              </div>
              <div>
                <span style={{ fontFamily: 'var(--display)', fontSize: 14, color: d2?.teamColor }}>
                  {d2?.code || '—'}
                </span>
              </div>
            </div>

            {STAT_DEFS.map(stat => (
              <StatRow key={stat.key} stat={stat} d1={d1} d2={d2} isMobile={isMobile} />
            ))}
          </div>

          {/* Race Log */}
          {races.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)' }}>
                  RACE LOG
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '28px 1fr 1fr 1fr' : '36px 1fr 1fr 1fr',
                gap: isMobile ? 6 : 12,
                padding: isMobile ? '0 10px 6px' : '0 16px 8px',
              }}>
                {['RND', 'RACE', d1?.code || 'D1', d2?.code || 'D2'].map(h => (
                  <span key={h} style={{
                    fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-dim)',
                    letterSpacing: '0.08em',
                  }}>{h}</span>
                ))}
              </div>

              {races.map((race, idx) => {
                if (!race) return null
                return isTeams ? (
                  <ConstructorRaceRow
                    key={race.round || idx}
                    race={race}
                    c1Id={id1}
                    c1Color={d1?.teamColor || '#e10600'}
                    c2Color={d2?.teamColor || '#3671C6'}
                    isMobile={isMobile}
                  />
                ) : (
                  <RaceLogRow
                    key={race.round || idx}
                    race={race}
                    driver1Id={id1}
                    driver2Id={id2}
                    d1Color={d1?.teamColor || '#e10600'}
                    d2Color={d2?.teamColor || '#3671C6'}
                    isMobile={isMobile}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
