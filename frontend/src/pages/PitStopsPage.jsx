import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, useIsMobile } from '../components/ui'

/* ── helpers ───────────────────────────────────────────────────────────────── */

// Colors for each stint number (0-indexed)
const STINT_PALETTE = [
  '#FFD700', // S1 – gold
  '#27F4D2', // S2 – cyan
  '#FF8000', // S3 – orange
  '#a855f7', // S4 – purple
  '#3671C6', // S5 – blue
  '#e10600', // S6 – red
]

function hex2rgba(hex, alpha) {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  } catch { return hex }
}

function formatDuration(secs) {
  if (!secs) return '—'
  if (secs >= 60) {
    const m = Math.floor(secs / 60)
    const s = (secs % 60).toFixed(3)
    return `${m}:${s.padStart(6, '0')}s`
  }
  return `${secs.toFixed(3)}s`
}

/* ── Build driver-keyed stint data ─────────────────────────────────────────── */

function buildDriverStints(pitstops, totalLaps) {
  const byDriver = {}
  for (const ps of pitstops) {
    if (!byDriver[ps.driverId]) {
      byDriver[ps.driverId] = {
        driverId:        ps.driverId,
        code:            ps.code,
        fullName:        ps.fullName,
        teamColor:       ps.teamColor,
        constructorName: ps.constructorName,
        finishPosition:  ps.finishPosition,
        laps:            ps.laps,
        stops:           [],
      }
    }
    byDriver[ps.driverId].stops.push({ lap: ps.lap, stop: ps.stop, duration: ps.duration })
  }

  // Build stints from stop markers
  const drivers = Object.values(byDriver).map(d => {
    const sortedStops = [...d.stops].sort((a, b) => a.lap - b.lap)
    const stints = []
    let prevLap = 0
    for (const s of sortedStops) {
      stints.push({ startLap: prevLap, endLap: s.lap - 1, stintNum: stints.length + 1 })
      prevLap = s.lap
    }
    // A driver who retired stops at their last lap, not the race distance
    stints.push({ startLap: prevLap, endLap: d.laps ?? totalLaps, stintNum: stints.length + 1 })
    return { ...d, stints }
  })

  // Sort by finish position
  return drivers.sort((a, b) => (a.finishPosition || 99) - (b.finishPosition || 99))
}

/* ── Stint bar row ─────────────────────────────────────────────────────────── */

function StintRow({ driver, totalLaps, isMobile }) {
  const [hoveredStop, setHoveredStop] = useState(null)
  const barW = totalLaps > 0 ? 100 : 0

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '36px 1fr' : '120px 1fr',
      alignItems: 'center',
      gap: isMobile ? 6 : 12,
      marginBottom: 6,
    }}>
      {/* Driver label */}
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: 'var(--display)', fontSize: isMobile ? 11 : 13,
          color: driver.teamColor, letterSpacing: '0.04em',
        }}>
          {driver.code}
        </div>
        {!isMobile && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
            P{driver.finishPosition < 99 ? driver.finishPosition : '—'}
          </div>
        )}
      </div>

      {/* Stint bar */}
      <div style={{ position: 'relative', height: isMobile ? 18 : 22 }}>
        {/* Stint segments */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', borderRadius: 4, overflow: 'hidden',
        }}>
          {driver.stints.map((s, i) => {
            const pctStart = (s.startLap / totalLaps) * barW
            const pctEnd   = (s.endLap   / totalLaps) * barW
            const pctWidth = Math.max(pctEnd - pctStart, 0.5)
            const color = STINT_PALETTE[i % STINT_PALETTE.length]
            return (
              <div
                key={i}
                title={`S${s.stintNum}: Laps ${s.startLap}–${s.endLap}`}
                style={{
                  width: `${pctWidth}%`,
                  background: hex2rgba(color, 0.70),
                  borderRight: i < driver.stints.length - 1 ? '2px solid #0a0a0b' : 'none',
                  flexShrink: 0,
                }}
              />
            )
          })}
        </div>

        {/* Pit stop markers */}
        {driver.stops.map((s, i) => {
          const pct = (s.lap / totalLaps) * 100
          const isHovered = hoveredStop === i
          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredStop(i)}
              onMouseLeave={() => setHoveredStop(null)}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                top: 0, bottom: 0,
                width: isHovered ? 3 : 2,
                background: '#fff',
                cursor: 'pointer',
                zIndex: 2,
                transform: 'translateX(-50%)',
              }}
            >
              {/* Tooltip */}
              {isHovered && (
                <div style={{
                  position: 'absolute',
                  bottom: '120%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#18181cee',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  padding: '6px 10px',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Stop {s.stop} · Lap {s.lap}</div>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{formatDuration(s.duration)}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Lap axis ──────────────────────────────────────────────────────────────── */

function LapAxis({ totalLaps, isMobile }) {
  const ticks = isMobile ? 5 : 10
  const intervals = []
  for (let i = 0; i <= ticks; i++) {
    intervals.push(Math.round((totalLaps / ticks) * i))
  }
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '36px 1fr' : '120px 1fr',
      gap: isMobile ? 6 : 12,
      marginBottom: 12,
    }}>
      <div />
      <div style={{ position: 'relative', height: 16 }}>
        {intervals.map((lap, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(lap / totalLaps) * 100}%`,
              transform: 'translateX(-50%)',
              fontFamily: 'var(--mono)', fontSize: 9,
              color: 'var(--text-dim)',
            }}
          >
            {lap}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Round Selector ────────────────────────────────────────────────────────── */

function RoundSelector({ schedule, selectedRound, onChange }) {
  if (!schedule?.races?.length) return null
  const today     = new Date().toISOString().slice(0, 10)
  const completed = schedule.races.filter(r => r.date <= today)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>ROUND</span>
      <select
        value={selectedRound}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 6, color: 'var(--text)', padding: '4px 28px 4px 10px',
          fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer',
          outline: 'none', appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b6b7a'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
        }}
      >
        <option value="last">Latest</option>
        {completed.map(r => (
          <option key={r.round} value={r.round}>R{r.round} – {r.raceName}</option>
        ))}
      </select>
    </div>
  )
}

/* ── Legend ────────────────────────────────────────────────────────────────── */

function StintLegend({ maxStints }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {Array.from({ length: Math.min(maxStints, STINT_PALETTE.length) }, (_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '3px 10px', fontSize: 10,
          fontFamily: 'var(--mono)',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: STINT_PALETTE[i] }} />
          <span style={{ color: 'var(--text-muted)' }}>Stint {i + 1}</span>
        </div>
      ))}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '3px 10px', fontSize: 10,
        fontFamily: 'var(--mono)',
      }}>
        <div style={{ width: 2, height: 12, background: '#fff', borderRadius: 1 }} />
        <span style={{ color: 'var(--text-muted)' }}>Pit stop</span>
      </div>
    </div>
  )
}

/* ── Fastest / slowest stops summary ──────────────────────────────────────── */

function StopsSummary({ pitstops }) {
  if (!pitstops?.length) return null
  const withDuration = pitstops.filter(p => p.duration > 1)
  if (!withDuration.length) return null
  const sorted = [...withDuration].sort((a, b) => a.duration - b.duration)
  const fastest = sorted[0]
  const slowest = sorted[sorted.length - 1]
  const avg = sorted.reduce((a, b) => a + b.duration, 0) / sorted.length

  return (
    <div style={{
      display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20,
    }}>
      {[
        { label: '⚡ Fastest Stop', val: formatDuration(fastest.duration), sub: `${fastest.code} · Lap ${fastest.lap}`, color: '#FFD700' },
        { label: '🐢 Slowest Stop', val: formatDuration(slowest.duration), sub: `${slowest.code} · Lap ${slowest.lap}`, color: '#e10600' },
        { label: '📊 Avg Duration', val: formatDuration(avg), sub: `${sorted.length} stops`, color: 'var(--text-muted)' },
        { label: '🔧 Total Stops',  val: sorted.length,  sub: `${Object.keys(pitstops.reduce((m, p) => { m[p.driverId] = 1; return m }, {})).length} drivers`, color: 'var(--text-muted)' },
      ].map(({ label, val, sub, color }) => (
        <div key={label} style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 16px', minWidth: 130,
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginBottom: 4 }}>{label}</div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 22, color, lineHeight: 1 }}>{val}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>{sub}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function PitStopsPage({ season }) {
  const isMobile      = useIsMobile()
  const [selectedRound, setSelectedRound] = useState('last')

  const { data: schedule } = useQuery({
    queryKey: ['schedule', season],
    queryFn:  () => f1Api.getSchedule(season),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['pitstops', season, selectedRound],
    queryFn:  () => f1Api.getPitStops(season, selectedRound),
  })

  const drivers = useMemo(() => {
    if (!data?.pitstops?.length) return []
    return buildDriverStints(data.pitstops, data.totalLaps)
  }, [data])

  const maxStints = useMemo(() =>
    drivers.reduce((m, d) => Math.max(m, d.stints.length), 0), [drivers])

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between', marginBottom: 24,
        flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 28, background: 'var(--red)', borderRadius: 2 }} />
            <h2 style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 24 : 32, letterSpacing: '0.06em' }}>
              PIT STOP STRATEGY
            </h2>
          </div>
          {data && (
            <div style={{ paddingLeft: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{data.flag}</span>
              <span style={{ fontFamily: 'var(--display)', fontSize: 15, letterSpacing: '0.04em' }}>
                {data.raceName}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                · Round {data.round} · {data.totalLaps} laps
              </span>
            </div>
          )}
        </div>
        <RoundSelector schedule={schedule} selectedRound={selectedRound} onChange={setSelectedRound} />
      </div>

      {isLoading && <Loader label="Loading pit stop data..." />}
      {error && <ErrorMsg error={error} />}

      {!isLoading && !error && data && (
        <>
          <StopsSummary pitstops={data.pitstops} />
          <StintLegend maxStints={maxStints} />

          {drivers.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12, padding: 20 }}>
              No pit stop data available for this round.
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: isMobile ? '16px 12px' : '20px 24px',
              animation: 'fadeUp 0.3s ease',
            }}>
              {/* Lap axis header */}
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-dim)',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
                display: 'grid',
                gridTemplateColumns: isMobile ? '36px 1fr' : '120px 1fr',
                gap: isMobile ? 6 : 12,
              }}>
                <div style={{ textAlign: 'right' }}>DRV</div>
                <div>LAP →</div>
              </div>

              <LapAxis totalLaps={data.totalLaps} isMobile={isMobile} />

              {/* Driver rows */}
              {drivers.map(d => (
                <StintRow
                  key={d.driverId}
                  driver={d}
                  totalLaps={data.totalLaps}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
