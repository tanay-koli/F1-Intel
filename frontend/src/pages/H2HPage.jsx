import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, useIsMobile } from '../components/ui'
import { ConstructorImage } from '../components/F1Image'
import SectionHeading from '../components/SectionHeading'
import { shortGpName, surname } from '../lib/format'
import { inkOn } from '../lib/color'
import ranked from './ranked.module.css'
import styles from './h2h.module.css'

/* ── helpers ───────────────────────────────────────────────────────────────── */

const FALLBACK_1 = '#E10600'
const FALLBACK_2 = '#3671C6'
// Teammates share a team colour, so the second side switches to the ink colour.
const SECOND_WHEN_SAME = '#F3F3F4'

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

/* ── Driver picker ─────────────────────────────────────────────────────────── */

function Picker({ label, value, onChange, options, noun }) {
  return (
    <label className={`field ${styles.picker}`}>
      {label}
      <select className="select" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Select a {noun}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  )
}

/* ── Stat comparison ───────────────────────────────────────────────────────── */

function StatRow({ stat, d1, d2, c1, c2 }) {
  const v1 = d1?.[stat.key] ?? 0
  const v2 = d2?.[stat.key] ?? 0
  const d1Wins = stat.lowerBetter ? v1 < v2 : v1 > v2
  const d2Wins = stat.lowerBetter ? v2 < v1 : v2 > v1
  const fmt = v => (stat.decimals ? Number(v).toFixed(stat.decimals) : v)

  return (
    <div className={styles.statRow}>
      <span className={styles.statValue} data-win={d1Wins || undefined} style={{ '--side': c1, textAlign: 'right' }}>{fmt(v1)}</span>
      <span className={styles.statLabel}>{stat.label}</span>
      <span className={styles.statValue} data-win={d2Wins || undefined} style={{ '--side': c2 }}>{fmt(v2)}</span>
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
    <div className={styles.split}>
      <div className={styles.splitHead}>
        <span className={styles.splitCount}>{d1.code} {n1}</span>
        <span className={styles.splitLabel}>{label}</span>
        <span className={styles.splitCount}>{n2} {d2.code}</span>
      </div>
      <div className={styles.splitBar} role="img" aria-label={`${label}: ${d1.code} ${n1}, ${d2.code} ${n2}`}>
        {n1 > 0 && <div style={{ flex: n1, background: c1 }} />}
        {n2 > 0 && <div style={{ flex: n2, background: c2 }} />}
      </div>
    </div>
  )
}

/* ── Race log table ────────────────────────────────────────────────────────── */

function Tag({ children, strong, color }) {
  return (
    <span className={styles.tag} data-strong={strong || undefined} style={strong ? { borderColor: color } : undefined}>
      {children}
    </span>
  )
}

/** A side's cell: the result (bold, with a mark in the side's colour, when it won the round), then its tags. */
function Cell({ isWinner, color, children }) {
  return (
    <div className={styles.cell} data-win={isWinner || undefined}>
      {isWinner && <span aria-hidden="true" className={styles.winMark} style={{ background: color }} />}
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
      {r?.points > 0 && <span className={styles.cellPts}>+{r.points}</span>}
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
    <li className={styles.logRow}>
      <span className={styles.logRound}>R{race.round}</span>
      <span className={styles.logRace}>{isMobile ? shortGpName(race.raceName) : race.raceName}</span>
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
      {side?.points > 0 && <span className={styles.cellPts}>+{side.points}</span>}
    </Cell>
  )
  return (
    <LogRow race={race} isMobile={isMobile}>
      {cell(race.c1, isC1Win, c1)}
      {cell(race.c2, isC2Win, c2)}
    </LogRow>
  )
}

/* ── Hero band per side ────────────────────────────────────────────────────── */

function DriverHero({ driver, color, side, isMobile, isTeams }) {
  if (!driver?.fullName) return <div />

  return (
    <div className={styles.hero} data-side={side} style={{ '--team': color, '--ink': inkOn(color) }}>
      {isTeams ? (
        <ConstructorImage constructorId={driver.constructorId} width={isMobile ? 36 : 56} height={isMobile ? 36 : 56}
          color={driver.teamColor} name={driver.fullName} alt={`${driver.fullName} logo`} />
      ) : (
        <span className={styles.heroCode} aria-hidden="true">{driver.code}</span>
      )}
      <div className={styles.heroText}>
        <div className={styles.heroName}>{isMobile && !isTeams ? surname(driver) : driver.fullName}</div>
        <div className={styles.heroSub}>{driver.constructorName}</div>
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
      <header className={ranked.header}>
        <div>
          <SectionHeading as="h1" title="Head to head" badge={season} />
          <p className={ranked.sub}>Compare two {mode.noun}s across the season: stats, records and every race.</p>
        </div>
      </header>

      {/* Drivers | Constructors */}
      <div role="group" aria-label="Compare" className={ranked.tabs}>
        {Object.entries(MODES).map(([key, m]) => (
          <button
            key={key}
            type="button"
            id={`h2h-mode-${key}`}
            className={ranked.tab}
            aria-pressed={modeKey === key}
            onClick={() => setMode(key)}
          >
            {m.noun[0].toUpperCase() + m.noun.slice(1)}s
          </button>
        ))}
      </div>

      <div className={styles.pickers}>
        <Picker label={`First ${mode.noun}`} value={id1} onChange={setPick(0)} options={options} noun={mode.noun} />
        <span className={styles.vs} aria-hidden="true">vs</span>
        <Picker label={`Second ${mode.noun}`} value={id2} onChange={setPick(1)} options={options} noun={mode.noun} />
      </div>

      {!canLoad && !isLoading && (
        <p className={styles.empty}>Select two different {mode.noun}s to compare them.</p>
      )}

      {isLoading && <Loader label="Computing head-to-head stats..." />}
      {error && <ErrorMsg error={error} />}

      {data && !isLoading && (
        <div>
          <div className={styles.heroes}>
            <DriverHero driver={d1} color={c1} side="left"  isMobile={isMobile} isTeams={isTeams} />
            <DriverHero driver={d2} color={c2} side="right" isMobile={isMobile} isTeams={isTeams} />
          </div>

          <div className={styles.splits}>
            <H2HBar d1={d1} d2={d2} c1={c1} c2={c2} valueKey="headToHeadWins" label="Finished ahead" />
            <H2HBar d1={d1} d2={d2} c1={c1} c2={c2} valueKey="qualiWins"      label="Qualified ahead" />
          </div>

          <section aria-label="Season stats" className={styles.stats}>
            <div className={styles.statHead}>
              <span style={{ textAlign: 'right' }}>{d1?.code || '—'}</span>
              <span />
              <span>{d2?.code || '—'}</span>
            </div>
            {STAT_DEFS.map(stat => (
              <StatRow key={stat.key} stat={stat} d1={d1} d2={d2} c1={c1} c2={c2} />
            ))}
          </section>

          {races.length > 0 && (
            <section aria-labelledby="race-log-heading">
              <SectionHeading id="race-log-heading" title="Race by race" />

              <div className={styles.log}>
                <div aria-hidden="true" className={`${styles.logRow} ${styles.logHead}`}>
                  <span className={styles.logRound}>Round</span>
                  <span>Race</span>
                  <span>{d1?.code || 'First'}</span>
                  <span>{d2?.code || 'Second'}</span>
                </div>

                <ol className={styles.logList}>
                  {races.map((race, idx) => {
                    if (!race) return null
                    return isTeams ? (
                      <ConstructorRaceRow key={race.round || idx} race={race} c1Id={id1} c1={c1} c2={c2} isMobile={isMobile} />
                    ) : (
                      <RaceLogRow key={race.round || idx} race={race} driver1Id={id1} driver2Id={id2} c1={c1} c2={c2} isMobile={isMobile} />
                    )
                  })}
                </ol>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
