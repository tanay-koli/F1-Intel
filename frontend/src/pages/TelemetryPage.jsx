import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { f1Api } from '../api'
import { CURRENT_SEASON } from '../hooks/useSeason'
import { Loader, ErrorMsg, SectionHeader, TeamDot, useIsMobile } from '../components/ui'
import DriverMark from '../components/DriverMark'
import SectionHeading from '../components/SectionHeading'
import RaceHeader from './RaceHeader'
import { Play, Pause } from 'lucide-react'
import { inkOn } from '../lib/color'
import { GRID } from '../lib/chartTheme'
import ranked from './ranked.module.css'
import tstyles from './telemetry.module.css'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
  AreaChart, Area, ScatterChart, Scatter, Cell,
} from 'recharts'

// ── Constants ─────────────────────────────────────────────────────────────────

const FIRST_TELEMETRY_YEAR = 2018

/** Years for the year pickers, newest first (the viewed season may be next year's). */
function telemetryYears(season) {
  const latest = Math.max(Number(CURRENT_SEASON), Number(season))
  return Array.from({ length: latest - FIRST_TELEMETRY_YEAR + 1 }, (_, i) => String(latest - i))
}

const SESSION_OPTS = [
  { value: 'R',   label: 'Race' },
  { value: 'Q',   label: 'Qualifying' },
  { value: 'FP1', label: 'Practice 1' },
  { value: 'FP2', label: 'Practice 2' },
  { value: 'FP3', label: 'Practice 3' },
]

const METRIC_TABS = [
  { id: 'speed',    label: 'Speed',    unit: 'km/h' },
  { id: 'throttle', label: 'Throttle', unit: '%'    },
  { id: 'brake',    label: 'Brake',    unit: '%'    },
  { id: 'gear',     label: 'Gear',     unit: ''     },
]

const COMPOUND_COLORS = {
  SOFT:    '#E8002D',
  MEDIUM:  '#FFF200',
  HARD:    '#FFFFFF',
  INTER:   '#39B54A',
  WET:     '#0067FF',
  UNKNOWN: '#888888',
}

const EVENT_COLORS = {
  SC:     '#FFA500',
  VSC:    '#FFD700',
  RED:    '#FF2020',
  YELLOW: '#FFFF00',
  GREEN:  '#00CC00',
}

const VIEW_TABS = [
  { id: 'analysis', label: 'Race Analysis' },
  { id: 'fastlap',  label: 'Fastest Lap Trace' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSecs(s) {
  if (s == null) return 'N/A'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(3).padStart(6, '0')
  return m > 0 ? `${m}:${sec}` : `${(s).toFixed(3)}s`
}

function buildChartData(tel) {
  if (!tel?.distance) return []
  return tel.distance.map((d, i) => ({
    dist:     Math.round(d),
    speed1:   tel.driver1.speed[i],
    speed2:   tel.driver2.speed[i],
    throttle1: tel.driver1.throttle[i],
    throttle2: tel.driver2.throttle[i],
    brake1:   tel.driver1.brake[i],
    brake2:   tel.driver2.brake[i],
    gear1:    tel.driver1.gear[i],
    gear2:    tel.driver2.gear[i],
  }))
}

// ── Shared Sub-components ─────────────────────────────────────────────────────

function SelectBox({ label, value, onChange, children, disabled }) {
  return (
    <label className="field">
      {label}
      <select className="select" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
        {children}
      </select>
    </label>
  )
}

function DriverCard({ driver, label, extra }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--bg-elevated)', borderRadius: 16, padding: '10px 14px',
    }}>
      <DriverMark driver={driver} size={40} />
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{driver.fullName}</div>
        {driver.lapTime && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lap {driver.lapTime}</div>}
        {extra}
      </div>
    </div>
  )
}

function StatPill({ label, value, color, highlight }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--bg-elevated)',
      border: `1px solid ${highlight ? 'var(--text-muted)' : 'var(--border)'}`,
      borderRadius: 20, padding: '4px 12px', fontSize: 11,
    }}>
      {color && <TeamDot color={color} size={7} />}
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--body)', color: 'var(--text)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function TyreBand({ laps, pitLaps, color, height = 10, maxLap }) {
  const stints = []
  let currentStint = null
  for (const l of laps) {
    if (!currentStint || currentStint.compound !== l.compound) {
      if (currentStint) stints.push(currentStint)
      currentStint = { compound: l.compound, start: l.lap, end: l.lap }
    } else {
      currentStint.end = l.lap
    }
  }
  if (currentStint) stints.push(currentStint)
  if (!maxLap || maxLap === 0) return null

  return (
    <div style={{ position: 'relative', height, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
      {stints.map((s, i) => {
        const left  = ((s.start - 1) / maxLap) * 100
        const width = ((s.end - s.start + 1) / maxLap) * 100
        return (
          <div key={i} style={{
            position: 'absolute', left: `${left}%`, width: `${width}%`,
            height: '100%',
            background: COMPOUND_COLORS[s.compound] ?? '#888',
            opacity: 0.85,
          }} title={`${s.compound} (L${s.start}–${s.end})`} />
        )
      })}
      {pitLaps.map(lap => (
        <div key={lap} style={{
          position: 'absolute',
          left: `${((lap - 1) / maxLap) * 100}%`,
          width: 2, height: '100%',
          background: color, opacity: 0.9,
        }} title={`Pit: Lap ${lap}`} />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL RACE OVERVIEW (ALL DRIVERS)
// ═══════════════════════════════════════════════════════════════════════════════

function RaceEventsBanner({ events, totalLaps }) {
  if (!events || events.length === 0) return null
  const scEvents = events.filter(e => e.type === 'SC' || e.type === 'VSC' || e.type === 'RED')
  if (scEvents.length === 0) return null

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '12px 16px', marginBottom: 16,
    }}>
      <div style={{
        fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)',
        marginBottom: 10,
      }}>
        Race Events
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {scEvents.map((ev, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: `${EVENT_COLORS[ev.type]}15`,
            border: `1px solid ${EVENT_COLORS[ev.type]}40`,
            borderRadius: 6, padding: '5px 10px', fontSize: 11,
          }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: EVENT_COLORS[ev.type],
            }} />
            <span style={{ fontFamily: 'var(--body)', color: EVENT_COLORS[ev.type], fontWeight: 600 }}>
              {ev.type}
            </span>
            {ev.lap && (
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--body)' }}>
                L{ev.lap}
              </span>
            )}
            <span style={{ color: 'var(--text-dim)', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ev.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AllDriversSummaryTable({ analysis, onSelectDriver, selectedDriver }) {
  const drivers = analysis.drivers
  const fl = analysis.overallFastestLap

  return (
    <div className={tstyles.tableWrap}>
      <table className={tstyles.table}>
        <thead>
          <tr>
            <th>Grid</th>
            <th>Pos</th>
            <th className={tstyles.left}>Driver</th>
            <th className={tstyles.left}>Team</th>
            <th>Fastest lap</th>
            <th>Avg lap</th>
            <th>Stops</th>
            <th className={tstyles.left}>Strategy</th>
            <th>Laps</th>
            <th>+/-</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map(d => {
            const isFL = fl.driver === d.code
            const isSelected = selectedDriver === d.code
            return (
              <tr key={d.code} data-selected={isSelected || undefined}>
                <td className={tstyles.muted}>{d.gridPosition ?? '—'}</td>
                <td className={tstyles.pos}>{d.finishPosition ?? '—'}</td>
                <td className={tstyles.left}>
                  <button
                    type="button"
                    className={tstyles.driverBtn}
                    aria-pressed={isSelected}
                    onClick={() => onSelectDriver(d.code)}
                  >
                    <DriverMark driver={d} size={30} />
                    <span>{d.fullName}</span>
                  </button>
                </td>
                <td className={`${tstyles.left} ${tstyles.muted}`}>{d.team}</td>
                <td>
                  {d.fastestLapTimeStr}
                  {isFL && <span className={tstyles.flTag}>Fastest</span>}
                </td>
                <td className={tstyles.muted}>{d.avgLapTimeStr}</td>
                <td>{d.pitStops}</td>
                <td className={tstyles.left}>
                  <div className={tstyles.stints}>
                    {d.stints.map((s, i) => (
                      <span key={i} className={tstyles.stint} title={`${s.compound} L${s.startLap}–${s.endLap} (${s.length} laps)`}>
                        <span className={tstyles.compound} style={{ background: COMPOUND_COLORS[s.compound] ?? '#888' }} />
                        {s.length}
                      </span>
                    ))}
                  </div>
                </td>
                <td className={tstyles.muted}>{d.totalLaps}</td>
                <td>{d.positionsGained == null ? '—' : d.positionsGained > 0 ? `+${d.positionsGained}` : d.positionsGained}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const thStyle = {
  padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)',
  fontWeight: 500, fontSize: 12,
}
const tdStyle = { padding: '6px 10px' }

function PositionChart({ analysis, highlightDriver, isMobile }) {
  const drivers = analysis.drivers
  const totalLaps = analysis.totalLaps

  // Build chart data: each lap is a row, each driver gets a position column
  const chartData = useMemo(() => {
    const data = []
    for (let lap = 1; lap <= totalLaps; lap++) {
      const row = { lap }
      drivers.forEach(d => {
        const lapData = d.laps.find(l => l.lap === lap)
        row[d.code] = lapData?.position ?? null
      })
      data.push(row)
    }
    return data
  }, [drivers, totalLaps])

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '16px', marginBottom: 20,
    }}>
      <div style={{
        fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
      }}>
        Positions, lap by lap
      </div>
      <ResponsiveContainer width="100%" height={isMobile ? 280 : 380}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis
            dataKey="lap"
            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--body)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            tickFormatter={v => `L${v}`}
            interval={Math.max(1, Math.floor(totalLaps / 10))}
          />
          <YAxis
            reversed
            domain={[1, drivers.length]}
            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--body)' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `P${v}`}
          />
          <Tooltip content={<PosChartTooltip drivers={drivers} />} />
          {drivers.map(d => (
            <Line
              key={d.code}
              type="monotone"
              dataKey={d.code}
              stroke={d.teamColor}
              strokeWidth={highlightDriver === d.code ? 3 : 1.2}
              strokeOpacity={highlightDriver && highlightDriver !== d.code ? 0.2 : 0.85}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)', marginTop: 6, textAlign: 'center' }}>
        P1 is at the top. Pick a row in the table above to highlight a driver.
      </div>
    </div>
  )
}

function PosChartTooltip({ active, payload, label, drivers }) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].filter(p => p.value != null).sort((a, b) => a.value - b.value).slice(0, 10)
  return (
    <div style={{
      background: '#18181cee', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: 'var(--body)', fontSize: 11, minWidth: 140, maxHeight: 260, overflowY: 'auto',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>Lap {label}</div>
      {sorted.map(p => {
        const drv = drivers.find(d => d.code === p.dataKey)
        return (
          <div key={p.dataKey} style={{
            display: 'flex', justifyContent: 'space-between', gap: 16,
            color: 'var(--text)', marginBottom: 2,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {drv?.teamColor && <TeamDot color={drv.teamColor} size={7} />}{p.dataKey}
            </span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>P{p.value}</span>
          </div>
        )
      })}
    </div>
  )
}

function LapTimeScatter({ analysis, highlightDriver, isMobile }) {
  const chartData = useMemo(() => {
    const points = []
    analysis.drivers.forEach(d => {
      d.laps.forEach(l => {
        if (l.lapTime && l.lapTime > 10 && l.lap) {
          points.push({
            lap: l.lap,
            lapTime: l.lapTime,
            code: d.code,
            teamColor: d.teamColor,
            compound: l.compound,
            isPitLap: l.isPitLap,
            isHighlight: highlightDriver === d.code,
          })
        }
      })
    })
    return points
  }, [analysis, highlightDriver])

  // Compute y-axis range: median ± 8s to filter extreme outliers
  const times = chartData.map(p => p.lapTime).sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)] || 90
  const yMin = Math.max(median - 8, Math.min(...times))
  const yMax = median + 12

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '16px', marginBottom: 20,
    }}>
      <div style={{
        fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
      }}>
        Lap times, all drivers
      </div>
      <ResponsiveContainer width="100%" height={isMobile ? 260 : 340}>
        <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis
            dataKey="lap" type="number" name="Lap"
            domain={[1, analysis.totalLaps]}
            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--body)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            tickFormatter={v => `L${v}`}
          />
          <YAxis
            dataKey="lapTime" type="number" name="Lap Time"
            domain={[yMin, yMax]}
            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--body)' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => fmtSecs(v)}
          />
          <Tooltip content={<ScatterTooltip />} />
          <Scatter data={chartData} isAnimationActive={false}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.teamColor}
                fillOpacity={
                  entry.isPitLap ? 0.15 :
                  highlightDriver && !entry.isHighlight ? 0.1 :
                  0.7
                }
                r={entry.isHighlight ? 3.5 : 2}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)', marginTop: 6, textAlign: 'center' }}>
        Dimmed points = pit in/out laps. Outlier times clipped for readability.
      </div>
    </div>
  )
}

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: '#18181cee', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: 'var(--body)', fontSize: 11,
    }}>
      <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
        {d.code} · Lap {d.lap}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: COMPOUND_COLORS[d.compound] ?? '#888',
        }} />
        <span style={{ color: 'var(--text)' }}>{fmtSecs(d.lapTime)}</span>
        {d.isPitLap && <span style={{ color: 'var(--text-muted)' }}>Pit</span>}
      </div>
    </div>
  )
}

function AllDriversTyreStrategy({ analysis, isMobile }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '14px 16px', marginBottom: 20,
    }}>
      <div style={{
        fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)',
        marginBottom: 12,
      }}>
        Tyre Strategy · All Drivers
      </div>

      {/* Compound Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {Object.entries(COMPOUND_COLORS).filter(([k]) => k !== 'UNKNOWN').map(([compound, color]) => (
          <div key={compound} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--body)' }}>{compound}</span>
          </div>
        ))}
      </div>

      <div style={{ maxHeight: isMobile ? 400 : 600, overflowY: 'auto' }}>
        {analysis.drivers.map(d => (
          <div key={d.code} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{
                fontFamily: 'var(--body)', fontSize: 11, color: 'var(--text)',
                minWidth: 30, fontWeight: 600,
              }}>{d.code}</span>
              <span style={{
                fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)',
                minWidth: 25,
              }}>P{d.finishPosition ?? '—'}</span>
              <span style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)' }}>
                {d.pitLaps.length > 0 ? `${d.pitStops} stop${d.pitStops > 1 ? 's' : ''} · L${d.pitLaps.join(', L')}` : 'No stops'}
              </span>
            </div>
            <TyreBand laps={d.laps} pitLaps={d.pitLaps} color={d.teamColor} height={14} maxLap={analysis.totalLaps} />
          </div>
        ))}
      </div>

      {/* Lap axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)' }}>Lap 1</span>
        <span style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)' }}>Lap {analysis.totalLaps}</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// RACE ANALYST PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function RaceAnalystPanel({ insights, totalLaps, isMobile }) {
  const [currentLap, setCurrentLap] = useState(1)
  const [isPlaying, setIsPlaying]   = useState(false)
  const intervalRef = useRef(null)
  const panelRef    = useRef(null)

  // Auto-advance when playing
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentLap(prev => {
          if (prev >= totalLaps) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, 1500)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [isPlaying, totalLaps])

  // Keyboard navigation, only while the panel itself has focus, so the
  // arrow keys still scroll the page and Space still presses buttons
  function handleKeyDown(e) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      setCurrentLap(prev => Math.min(prev + 1, totalLaps))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      setCurrentLap(prev => Math.max(prev - 1, 1))
    } else if (e.key === ' ') {
      e.preventDefault()
      setIsPlaying(p => !p)
    }
  }

  if (!insights || insights.length === 0) return null

  const insight = insights[currentLap - 1]
  if (!insight) return null

  const progress = (currentLap / totalLaps) * 100

  return (
    <div
      ref={panelRef}
      id="race-analyst-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Race analyst. Arrow keys change lap, Space plays or pauses."
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden',
        animation: 'fadeUp 0.3s ease',
      }}
    >
      {/* Header + Slider */}
      <div style={{
        padding: '14px 18px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{
              fontFamily: 'var(--display)', fontWeight: 400, fontSize: 26, lineHeight: 1,
              textTransform: 'uppercase',
            }}>Race analyst</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              id="analyst-play-btn"
              type="button"
              className={tstyles.play}
              aria-pressed={isPlaying}
              onClick={() => setIsPlaying(p => !p)}
            >
              {isPlaying ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <div style={{
              fontFamily: 'var(--display)', fontSize: 22, color: 'var(--text)',
              minWidth: 80, textAlign: 'right',
            }}>
              <span>L{currentLap}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>/{totalLaps}</span>
            </div>
          </div>
        </div>

        {/* Slider track */}
        <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
          <div style={{
            position: 'absolute', top: 8, left: 0, right: 0, height: 4,
            background: 'var(--bg-elevated)', borderRadius: 2,
          }} />
          <div style={{
            position: 'absolute', top: 8, left: 0, height: 4,
            width: `${progress}%`, background: 'var(--text)',
            borderRadius: 2, transition: 'width 0.15s ease',
          }} />
          <input
            type="range"
            min={1}
            max={totalLaps}
            value={currentLap}
            onChange={e => setCurrentLap(Number(e.target.value))}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: 20,
              appearance: 'none', background: 'transparent', cursor: 'pointer',
              outline: 'none', zIndex: 2, margin: 0,
            }}
          />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)',
          marginTop: 2,
        }}>
          <span>L1</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>← →  arrow keys · space to play/pause</span>
          <span>L{totalLaps}</span>
        </div>
      </div>

      {/* Insight content */}
      <div style={{ padding: isMobile ? '12px 14px' : '16px 18px' }}>
        {/* Headline */}
        <div style={{
          fontSize: isMobile ? 14 : 16, fontWeight: 600, color: 'var(--text)',
          lineHeight: 1.4, marginBottom: 14,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span>{insight.headline}</span>
        </div>

        {/* 2-column grid: battles + strategy */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? 10 : 14,
          marginBottom: 12,
        }}>
          {/* Key Battles */}
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <div style={{
              fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)',
              marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              Battles
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
              fontFamily: 'var(--body)',
            }}>
              {insight.key_battles}
            </div>
          </div>

          {/* Strategy Watch */}
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <div style={{
              fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)',
              marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              Strategy
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
              fontFamily: 'var(--body)',
            }}>
              {insight.strategy_watch}
            </div>
          </div>
        </div>

        {/* Lap Mover */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 14px',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{
            fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginTop: 2,
          }}>
            Mover
          </span>
          <div style={{
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
            fontFamily: 'var(--body)',
          }}>
            {insight.lap_mover}
          </div>
        </div>
      </div>
    </div>
  )
}

function FullRaceOverview({ analysis, analystInsights, selectedDriver, onSelectDriver, isMobile }) {
  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <RaceHeader analysis={analysis} eventColors={EVENT_COLORS} />

      {/* Race Events */}
      <RaceEventsBanner events={analysis.raceEvents} totalLaps={analysis.totalLaps} />

      {/* Race Analyst Panel */}
      {analystInsights && analystInsights.length > 0 && (
        <RaceAnalystPanel insights={analystInsights} totalLaps={analysis.totalLaps} isMobile={isMobile} />
      )}

      <SectionHeading title="Full race overview" badge={`${analysis.drivers.length} drivers`} />

      {/* All Drivers Table */}
      <AllDriversSummaryTable analysis={analysis} onSelectDriver={onSelectDriver} selectedDriver={selectedDriver} />

      {/* Position Chart */}
      <PositionChart analysis={analysis} highlightDriver={selectedDriver} isMobile={isMobile} />

      {/* Lap Time Scatter */}
      <LapTimeScatter analysis={analysis} highlightDriver={selectedDriver} isMobile={isMobile} />

      {/* Tyre Strategy */}
      <AllDriversTyreStrategy analysis={analysis} isMobile={isMobile} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE DRIVER DEEP DIVE
// ═══════════════════════════════════════════════════════════════════════════════

function DriverDeepDive({ driver, analysis, isMobile }) {
  const fl = analysis.overallFastestLap
  const isRaceFL = fl.driver === driver.code
  const flDeltaToRace = driver.fastestLapTime && fl.time
    ? (driver.fastestLapTime - fl.time).toFixed(3)
    : null
  const flDeltaToAvg = driver.fastestLapTime && driver.avgLapTime
    ? (driver.avgLapTime - driver.fastestLapTime).toFixed(3)
    : null

  // Lap time chart data with compound segments
  const lapChartData = useMemo(() => {
    return driver.laps.filter(l => l.lap && l.lapTime && l.lapTime > 10).map(l => ({
      lap: l.lap,
      lapTime: l.lapTime,
      lapTimeStr: l.lapTimeStr,
      compound: l.compound,
      color: COMPOUND_COLORS[l.compound] ?? '#888',
      isPitLap: l.isPitLap,
      position: l.position,
      gapToLeader: l.gapToLeader,
      tyreLife: l.tyreLife,
      isFastestLap: l.lap === driver.fastestLap,
    }))
  }, [driver])

  return (
    <div style={{ animation: 'fadeUp 0.3s ease', marginTop: 32 }}>
      <SectionHeading title="Driver deep dive" />

      {/* Driver Header Card */}
      <div className={tstyles.diveHead} style={{ '--team': driver.teamColor, '--ink': inkOn(driver.teamColor) }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div className={tstyles.diveName}>{driver.fullName}</div>
          <div className={tstyles.diveTeam}>{driver.team}</div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Grid</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 30, lineHeight: 1 }}>P{driver.gridPosition ?? '—'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Finish</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 30, lineHeight: 1 }}>P{driver.finishPosition ?? '—'}</div>
          </div>
          {driver.positionsGained != null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Places</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 30, lineHeight: 1 }}>
                {driver.positionsGained > 0 ? `+${driver.positionsGained}` : driver.positionsGained < 0 ? driver.positionsGained : '0'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Key Stats */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatPill label="Fastest Lap" value={`${driver.fastestLapTimeStr} (L${driver.fastestLap ?? '—'})`} color={driver.teamColor} highlight={isRaceFL} />
        <StatPill label="Average Lap" value={driver.avgLapTimeStr} color={driver.teamColor} />
        <StatPill label="Pit Stops" value={driver.pitStops} color={driver.teamColor} />
        <StatPill label="Total Laps" value={driver.totalLaps} />
        {isRaceFL && <StatPill label="" value="Race Fastest Lap!" highlight />}
      </div>

      {/* Fastest Lap Analysis Card */}
      <div style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isRaceFL ? 'var(--text-muted)' : 'var(--border)'}`,
        borderRadius: 16, padding: '14px 18px', marginBottom: 20,
      }}>
        <div style={{
          fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)',
          marginBottom: 12,
        }}>
          Fastest Lap Analysis
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)' }}>LAP</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 20, color: 'var(--text)' }}>L{driver.fastestLap ?? '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)' }}>Time</div>
            <div style={{ fontFamily: 'var(--body)', fontSize: 16, color: 'var(--text)' }}>
              {driver.fastestLapTimeStr}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)' }}>Compound</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{
                display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                background: COMPOUND_COLORS[driver.fastestLapCompound] ?? '#888',
              }} />
              <span style={{ fontFamily: 'var(--body)', fontSize: 14 }}>{driver.fastestLapCompound ?? 'N/A'}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)' }}>vs race fastest lap</div>
            <div style={{
              fontFamily: 'var(--body)', fontSize: 16,
              color: 'var(--text)',
            }}>
              {isRaceFL ? '— HOLDER' : flDeltaToRace ? `+${flDeltaToRace}s` : 'N/A'}
            </div>
          </div>
        </div>
        {flDeltaToAvg && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--body)' }}>
            Their FL was <strong style={{ color: 'var(--text)' }}>{flDeltaToAvg}s faster</strong> than their average lap ({driver.avgLapTimeStr})
          </div>
        )}
      </div>

      {/* Tyre Strategy Band */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '14px 16px', marginBottom: 20,
      }}>
        <div style={{
          fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)',
          marginBottom: 10,
        }}>
          Tyre Strategy
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {driver.stints.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: `${COMPOUND_COLORS[s.compound] ?? '#888'}15`,
              border: `1px solid ${COMPOUND_COLORS[s.compound] ?? '#888'}40`,
              borderRadius: 6, padding: '5px 10px', fontSize: 11, fontFamily: 'var(--body)',
            }}>
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                background: COMPOUND_COLORS[s.compound] ?? '#888',
              }} />
              <span style={{ color: 'var(--text)' }}>{s.compound}</span>
              <span style={{ color: 'var(--text-dim)' }}>L{s.startLap}–{s.endLap}</span>
              <span style={{ color: 'var(--text-muted)' }}>({s.length} laps)</span>
            </div>
          ))}
        </div>
        <TyreBand laps={driver.laps} pitLaps={driver.pitLaps} color={driver.teamColor} height={18} maxLap={analysis.totalLaps} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)' }}>Lap 1</span>
          <span style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)' }}>Lap {analysis.totalLaps}</span>
        </div>
      </div>

      {/* Lap Time Chart */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '16px', marginBottom: 20,
      }}>
        <div style={{
          fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
        }}>
          Lap times, {driver.code}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={lapChartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis
              dataKey="lap"
              tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--body)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              tickFormatter={v => `L${v}`}
              interval={Math.max(1, Math.floor(analysis.totalLaps / 12))}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--body)' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => fmtSecs(v)}
            />
            <Tooltip content={<DeepDiveTooltip driver={driver} />} />
            {/* Average lap reference line */}
            {driver.avgLapTime && (
              <ReferenceLine y={driver.avgLapTime} stroke={driver.teamColor} strokeDasharray="6 3" strokeOpacity={0.5} />
            )}
            {/* Pit stop reference lines */}
            {driver.pitLaps.map(lap => (
              <ReferenceLine key={`pit-${lap}`} x={lap} stroke="#A9A9B0" strokeDasharray="3 3" strokeOpacity={0.6} />
            ))}
            {/* Fastest lap reference */}
            {driver.fastestLap && (
              <ReferenceLine x={driver.fastestLap} stroke={'#F3F3F4'} strokeDasharray="4 2" strokeOpacity={0.8} />
            )}
            <Line
              type="monotone" dataKey="lapTime"
              stroke={driver.teamColor} strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props
                if (!cx || !cy) return null
                if (payload.isFastestLap) {
                  return <circle cx={cx} cy={cy} r={5} fill={'#F3F3F4'} stroke={'#F3F3F4'} strokeWidth={2} />
                }
                return null
              }}
              activeDot={{ r: 4, fill: driver.teamColor }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)' }}>
            <div style={{ width: 16, height: 2, background: driver.teamColor, borderRadius: 1 }} /> Lap Time
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)' }}>
            <div style={{ width: 16, height: 0, borderTop: `2px dashed ${driver.teamColor}`, opacity: 0.5 }} /> Avg
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)' }}>
            <div style={{ width: 16, height: 0, borderTop: '2px dashed #A9A9B0', opacity: 0.6 }} /> Pit Stop
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F3F3F4' }} /> Fastest lap
          </div>
        </div>
      </div>

      {/* Position Progression Chart */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '16px', marginBottom: 20,
      }}>
        <div style={{
          fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
        }}>
          Position by lap, {driver.code}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={driver.laps.filter(l => l.lap && l.position)} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id={`posGrad-${driver.code}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={driver.teamColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={driver.teamColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis
              dataKey="lap"
              tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--body)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              tickFormatter={v => `L${v}`}
              interval={Math.max(1, Math.floor(analysis.totalLaps / 12))}
            />
            <YAxis
              reversed
              domain={[1, analysis.drivers.length]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--body)' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `P${v}`}
            />
            <Tooltip content={<PosProgressionTooltip driver={driver} />} />
            {driver.pitLaps.map(lap => (
              <ReferenceLine key={`pit-${lap}`} x={lap} stroke="#A9A9B0" strokeDasharray="3 3" strokeOpacity={0.5} />
            ))}
            <Area
              type="stepAfter" dataKey="position"
              stroke={driver.teamColor} strokeWidth={2}
              fill={`url(#posGrad-${driver.code})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Lap-by-Lap Table */}
      <div style={{
        fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)',
        marginBottom: 10,
      }}>
        Lap-by-Lap Detail · {driver.code}
      </div>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'auto', maxHeight: 500, marginBottom: 20,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--body)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
              <th style={thStyle}>Lap</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Time</th>
              <th style={thStyle}>Tyre</th>
              <th style={thStyle}>Age</th>
              <th style={thStyle}>Pos</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Gap</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {driver.laps.map(l => {
              const isFL = l.lap === driver.fastestLap
              const isSC = analysis.raceEvents?.some(e => e.lap === l.lap && (e.type === 'SC' || e.type === 'VSC'))
              return (
                <tr key={l.lap} style={{
                  borderBottom: '1px solid #1e1e24',
                  background: isFL || l.isPitLap ? 'var(--bg-elevated)' : 'transparent',
                }}>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{l.lap}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text)' }}>
                    {l.lapTimeStr}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: COMPOUND_COLORS[l.compound] ?? '#888',
                      verticalAlign: 'middle',
                    }} title={l.compound} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-dim)' }}>{l.tyreLife ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{l.position ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-dim)' }}>
                    {l.gapToLeader != null ? `+${l.gapToLeader}s` : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'left', fontSize: 12 }}>
                    {isFL && <span style={{ color: 'var(--text)', fontWeight: 700, marginRight: 4 }}>Fastest</span>}
                    {l.isPitLap && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Pit</span>}
                    {isSC && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>SC</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DeepDiveTooltip({ active, payload, label, driver }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: '#18181cee', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: 'var(--body)', fontSize: 11,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
        Lap {d.lap} {d.isFastestLap ? 'FL' : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: COMPOUND_COLORS[d.compound] ?? '#888',
        }} />
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>
          {d.lapTimeStr}
        </span>
      </div>
      <div style={{ color: 'var(--text-dim)' }}>
        P{d.position ?? '—'} · Tyre age: {d.tyreLife ?? '—'}
        {d.isPitLap && ' · Pit'}
      </div>
    </div>
  )
}

function PosProgressionTooltip({ active, payload, label, driver }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#18181cee', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px',
      fontFamily: 'var(--body)', fontSize: 11,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Lap {label}</div>
      <div style={{ color: 'var(--text)', fontWeight: 600 }}>P{payload[0]?.value ?? '—'}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASTEST LAP VIEW (PRESERVED FROM ORIGINAL)
// ═══════════════════════════════════════════════════════════════════════════════

function MetricTooltip({ active, payload, label, unit, driver1, driver2 }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#18181cee', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: 'var(--body)', fontSize: 11, minWidth: 160,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label} m</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{
          display: 'flex', justifyContent: 'space-between',
          gap: 16, color: p.stroke || p.fill, marginBottom: 3
        }}>
          <span>{p.dataKey.includes('1') ? driver1 : driver2}</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>
            {p.value}{unit}
          </span>
        </div>
      ))}
    </div>
  )
}

function DeltaBar({ tel, metric }) {
  const d1 = tel.driver1[metric]
  const d2 = tel.driver2[metric]
  if (!d1?.length) return null

  const avg1 = (d1.reduce((a, b) => a + b, 0) / d1.length).toFixed(1)
  const avg2 = (d2.reduce((a, b) => a + b, 0) / d2.length).toFixed(1)
  const max1 = Math.max(...d1).toFixed(1)
  const max2 = Math.max(...d2).toFixed(1)

  const unit = metric === 'speed' ? ' km/h' : metric === 'gear' ? '' : '%'

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      {[
        { label: `${tel.driver1.code} avg`, val: avg1, color: tel.driver1.teamColor },
        { label: `${tel.driver2.code} avg`, val: avg2, color: tel.driver2.teamColor },
        { label: `${tel.driver1.code} max`, val: max1, color: tel.driver1.teamColor },
        { label: `${tel.driver2.code} max`, val: max2, color: tel.driver2.teamColor },
      ].map(({ label, val, color }) => (
        <div key={label} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '3px 12px', fontSize: 11,
        }}>
          <TeamDot color={color} size={7} />
          <span style={{ color: 'var(--text-muted)' }}>{label}</span>
          <span style={{ fontFamily: 'var(--body)', color }}>{val}{unit}</span>
        </div>
      ))}
    </div>
  )
}

function SpeedChart({ data, tel, metric }) {
  const { unit } = METRIC_TABS.find(t => t.id === metric)
  const key1 = `${metric}1`
  const key2 = `${metric}2`
  const isArea = metric === 'throttle' || metric === 'brake'
  const Chart = isArea ? AreaChart : LineChart

  const yDomain = metric === 'gear' ? [1, 8] : undefined

  return (
    <ResponsiveContainer width="100%" height={270}>
      <Chart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={tel.driver1.teamColor} stopOpacity={0.25} />
            <stop offset="95%" stopColor={tel.driver1.teamColor} stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={tel.driver2.teamColor} stopOpacity={0.2} />
            <stop offset="95%" stopColor={tel.driver2.teamColor} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
        <XAxis
          dataKey="dist"
          tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--body)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          tickFormatter={v => `${(v/1000).toFixed(1)}km`}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={yDomain}
          tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--body)' }}
          axisLine={false} tickLine={false}
          tickFormatter={v => `${v}${unit}`}
        />
        <Tooltip content={
          <MetricTooltip
            unit={unit}
            driver1={tel.driver1.code}
            driver2={tel.driver2.code}
          />
        } />
        {isArea ? (
          <>
            <Area type="monotone" dataKey={key1} stroke={tel.driver1.teamColor}
              fill="url(#grad1)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey={key2} stroke={tel.driver2.teamColor}
              fill="url(#grad2)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </>
        ) : (
          <>
            <Line type="monotone" dataKey={key1} stroke={tel.driver1.teamColor}
              strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 3 }} />
            <Line type="monotone" dataKey={key2} stroke={tel.driver2.teamColor}
              strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 3 }} />
          </>
        )}
      </Chart>
    </ResponsiveContainer>
  )
}

function FastestLapView({ tel, isMobile }) {
  const [metric, setMetric] = useState('speed')
  const chartData = buildChartData(tel)

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      {/* Race banner */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '12px 18px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 20 }}>{tel.raceName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--body)' }}>
            {tel.year} · Round {tel.round} · {SESSION_OPTS.find(s => s.value === tel.session)?.label ?? tel.session} · Fastest Lap Comparison
          </div>
        </div>
      </div>

      {/* Driver cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <DriverCard driver={tel.driver1} label="Driver 1" />
        <DriverCard driver={tel.driver2} label="Driver 2" />
      </div>

      {/* Metric tabs */}
      <div className={ranked.tabs}>
        {METRIC_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            id={`metric-tab-${t.id}`}
            className={ranked.tab}
            aria-pressed={metric === t.id}
            onClick={() => setMetric(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <DeltaBar tel={tel} metric={metric} />

      {/* Chart */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '16px',
      }}>
        <div style={{
          fontFamily: 'var(--body)', fontSize: 12,
          color: 'var(--text-muted)', marginBottom: 12,
        }}>
          {METRIC_TABS.find(t => t.id === metric)?.label} over the lap
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          {[tel.driver1, tel.driver2].map(d => (
            <div key={d.code} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 2, background: d.teamColor, borderRadius: 1 }} />
              <span style={{ fontFamily: 'var(--body)', fontSize: 11, color: 'var(--text)' }}>
                {d.code}
              </span>
            </div>
          ))}
        </div>

        <SpeedChart data={chartData} tel={tel} metric={metric} />
      </div>

      {/* All charts mini-grid */}
      <div style={{ marginTop: 20 }}>
        <div style={{
          fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)',
          marginBottom: 12,
        }}>
          All Channels
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          {METRIC_TABS.map(t => (
            <div
              key={t.id}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '12px',
                cursor: 'pointer',
                outline: metric === t.id ? '2px solid var(--text-muted)' : 'none',
                transition: 'outline 0.15s',
              }}
              onClick={() => setMetric(t.id)}
            >
              <div style={{
                fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)',
                marginBottom: 8,
              }}>
                {t.label}
              </div>
              <SpeedChart data={chartData} tel={tel} metric={t.id} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function TelemetryPage({ season }) {
  const isMobile = useIsMobile()
  // `?round=N` (e.g. Home's "Open race analysis") opens that race's analysis directly
  const [searchParams] = useSearchParams()
  const linkedRound = searchParams.get('round')
  const [year,     setYear]     = useState(season)
  const years = telemetryYears(season)
  // null = not picked by hand: follow the latest race (set below once the schedule loads)
  const [roundPick, setRound]   = useState(linkedRound)
  const [viewTab,  setViewTab]  = useState('analysis')
  const [selectedDriver, setSelectedDriver] = useState('')

  // Fastest-lap-trace specific state
  const [driver1,  setDriver1]  = useState('')
  const [driver2,  setDriver2]  = useState('')
  const [session,  setSession]  = useState('R')
  const [fastlapQueryKey, setFastlapQueryKey] = useState(null)

  // Race analysis query key
  const [analysisQueryKey, setAnalysisQueryKey] = useState(
    linkedRound ? ['race-analysis', season, linkedRound] : null
  )

  // Schedule for round list
  const { data: schedule } = useQuery({
    queryKey: ['schedule', year],
    queryFn: () => f1Api.getSchedule(year),
    staleTime: 5 * 60 * 1000,
  })

  const today = new Date().toISOString().slice(0, 10)
  const completedRaces = schedule?.races?.filter(r => r.date <= today) ?? []
  // Latest race before today (a race run today usually has no data published yet)
  const latestRound = schedule?.races?.filter(r => r.date < today).at(-1)?.round
  const round = roundPick ?? (latestRound ? String(latestRound) : '1')
  // Until a round is picked by hand, the latest race loads without a click
  const analysisKey = analysisQueryKey ??
    (roundPick == null && latestRound ? ['race-analysis', year, String(latestRound)] : null)

  // Driver list from FastF1 (for fastest lap trace tab)
  const {
    data: driversData,
    isLoading: driversLoading,
    error: driversError,
  } = useQuery({
    queryKey: ['telemetry-drivers', year, round, session],
    queryFn: ({ queryKey: [, y, r, s] }) => f1Api.getTelemetryDrivers(Number(y), Number(r), s),
    enabled: !!round && round !== '' && viewTab === 'fastlap',
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
  const driverList = driversData?.drivers ?? []

  // Race Analysis (all drivers)
  const {
    data: analysisData,
    isLoading: analysisLoading,
    error: analysisError,
  } = useQuery({
    queryKey: analysisKey ?? ['analysis-placeholder'],
    queryFn: ({ queryKey: [, y, r] }) => f1Api.getRaceAnalysis(Number(y), Number(r)),
    enabled: !!analysisKey,
    staleTime: 30 * 60 * 1000,
    retry: 0,
  })

  // Race Analyst insights (auto-fetch when analysis loads)
  const {
    data: analystData,
  } = useQuery({
    queryKey: analysisKey ? ['race-analyst', ...analysisKey.slice(1)] : ['analyst-placeholder'],
    queryFn: ({ queryKey: [, y, r] }) => f1Api.getRaceAnalyst(Number(y), Number(r)),
    enabled: !!analysisKey && !!analysisData,
    staleTime: 30 * 60 * 1000,
    retry: 0,
  })
  const analystInsights = analystData?.insights ?? null

  // Fastest lap trace
  const {
    data: tel,
    isLoading: telLoading,
    error: telError,
  } = useQuery({
    queryKey: fastlapQueryKey ?? ['fastlap-tel-placeholder'],
    queryFn: ({ queryKey: [, y, r, s, d1, d2] }) => f1Api.getTelemetry(Number(y), Number(r), s, d1, d2),
    enabled: !!fastlapQueryKey,
    staleTime: 30 * 60 * 1000,
    retry: 0,
  })

  const handleLoadAnalysis = useCallback(() => {
    setAnalysisQueryKey(['race-analysis', year, round])
    setSelectedDriver('')
  }, [year, round])

  const handleLoadFastlap = useCallback(() => {
    if (!driver1 || !driver2) return
    setFastlapQueryKey(['fastlap-tel', year, round, session, driver1, driver2])
  }, [year, round, session, driver1, driver2])

  const selectedDriverData = useMemo(() => {
    if (!analysisData || !selectedDriver) return null
    return analysisData.drivers.find(d => d.code === selectedDriver) ?? null
  }, [analysisData, selectedDriver])

  const isLoading = viewTab === 'analysis' ? analysisLoading : telLoading
  const hasData   = viewTab === 'analysis' ? !!analysisData    : !!tel
  const canLoadFastlap = driver1 && driver2 && driver1 !== driver2

  return (
    <div>
      <SectionHeader
        title="Telemetry"
        count={viewTab === 'analysis' ? 'full race analysis' : 'fastest lap comparison'}
      />

      <p className={tstyles.notice}>
        Timing data from <strong>OpenF1</strong> (2023 on) and <strong>FastF1</strong> (2021–22).
        The first load of a session can take 10–60 s while the data downloads; after that it's instant.
      </p>

      {/* View tabs */}
      <div className={ranked.tabs}>
        {VIEW_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            id={`view-tab-${t.id}`}
            className={ranked.tab}
            aria-pressed={viewTab === t.id}
            onClick={() => setViewTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RACE ANALYSIS SELECTOR ── */}
      {viewTab === 'analysis' && (
        <div className={tstyles.controls}>
          <SelectBox label="Year" value={year} onChange={v => { setYear(v); setRound(null); setSelectedDriver(''); setAnalysisQueryKey(null) }}>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </SelectBox>

          <SelectBox label="Round" value={round} onChange={v => { setRound(v); setSelectedDriver(''); setAnalysisQueryKey(null) }}>
            {completedRaces.length === 0 && <option value="">Loading...</option>}
            {completedRaces.map(r => (
              <option key={r.round} value={r.round}>R{r.round} — {r.raceName}</option>
            ))}
          </SelectBox>

          <button
            id="load-analysis-btn"
            type="button"
            className={tstyles.primary}
            onClick={handleLoadAnalysis}
            disabled={analysisLoading}
          >
            {analysisLoading ? 'Loading…' : 'Load analysis'}
          </button>

          {/* Deep Dive driver selector — only shows after data loads */}
          {analysisData && !analysisLoading && (
            <SelectBox
              label="Deep dive driver"
              value={selectedDriver}
              onChange={setSelectedDriver}
            >
              <option value="">Pick a driver</option>
              {analysisData.drivers.map(d => (
                <option key={d.code} value={d.code}>P{d.finishPosition ?? '?'} · {d.code} — {d.fullName}</option>
              ))}
            </SelectBox>
          )}
        </div>
      )}

      {/* ── FASTEST LAP TRACE SELECTOR ── */}
      {viewTab === 'fastlap' && (
        <div className={tstyles.controls}>
          <SelectBox label="Year" value={year} onChange={v => { setYear(v); setRound(null); setDriver1(''); setDriver2('') }}>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </SelectBox>

          <SelectBox label="Round" value={round} onChange={v => { setRound(v); setDriver1(''); setDriver2('') }}>
            {completedRaces.length === 0 && <option value="">Loading...</option>}
            {completedRaces.map(r => (
              <option key={r.round} value={r.round}>R{r.round} — {r.raceName}</option>
            ))}
          </SelectBox>

          <SelectBox label="Session" value={session} onChange={v => { setSession(v); setDriver1(''); setDriver2('') }}>
            {SESSION_OPTS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </SelectBox>

          <SelectBox
            label="First driver"
            value={driver1}
            onChange={setDriver1}
            disabled={driversLoading || driverList.length === 0}
          >
            <option value="">Pick a driver</option>
            {driverList.filter(d => d.driverId !== driver2).map(d => (
              <option key={d.driverId} value={d.driverId}>{d.code} — {d.fullName}</option>
            ))}
          </SelectBox>

          <SelectBox
            label="Second driver"
            value={driver2}
            onChange={setDriver2}
            disabled={driversLoading || driverList.length === 0}
          >
            <option value="">Pick a driver</option>
            {driverList.filter(d => d.driverId !== driver1).map(d => (
              <option key={d.driverId} value={d.driverId}>{d.code} — {d.fullName}</option>
            ))}
          </SelectBox>

          <button
            id="load-telemetry-btn"
            type="button"
            className={tstyles.primary}
            onClick={handleLoadFastlap}
            disabled={!canLoadFastlap || telLoading}
          >
            {telLoading ? 'Loading…' : 'Compare laps'}
          </button>
        </div>
      )}

      {/* Driver list loading (fastlap tab) */}
      {viewTab === 'fastlap' && driversLoading && (
        <Loader label="Loading session drivers (may take 20–40s on first load)…" />
      )}
      {viewTab === 'fastlap' && driversError && (
        <ErrorMsg error={driversError} context="Driver list" />
      )}

      {/* Loading / Error */}
      {isLoading && (
        <Loader label={`Fetching ${viewTab === 'analysis' ? 'full race analysis for all drivers' : 'fastest lap telemetry'} — downloading session data (20–60s first time)…`} />
      )}
      {viewTab === 'analysis' && analysisError && (
        <ErrorMsg error={analysisError} context="Race analysis" />
      )}
      {viewTab === 'fastlap' && telError && (
        <ErrorMsg error={telError} context="Telemetry" />
      )}

      {/* ── Race Analysis View ── */}
      {viewTab === 'analysis' && analysisData && !analysisLoading && (
        <>
          <FullRaceOverview
            analysis={analysisData}
            analystInsights={analystInsights}
            selectedDriver={selectedDriver}
            onSelectDriver={setSelectedDriver}
            isMobile={isMobile}
          />
          {selectedDriverData && (
            <DriverDeepDive
              driver={selectedDriverData}
              analysis={analysisData}
              isMobile={isMobile}
            />
          )}
        </>
      )}

      {/* ── Fastest Lap Trace ── */}
      {viewTab === 'fastlap' && tel && !telLoading && (
        <FastestLapView tel={tel} isMobile={isMobile} />
      )}

      {/* Empty state */}
      {!hasData && !isLoading && !(viewTab === 'analysis' ? analysisError : telError) && (
        <div className={tstyles.empty}>
          <p>
            {viewTab === 'analysis'
              ? 'Pick a year and round, then load the analysis for the full race breakdown.'
              : 'Pick two drivers, then compare their fastest laps.'}
          </p>
          <p className={tstyles.emptySub}>
            {viewTab === 'analysis'
              ? 'Positions, lap times, tyre strategy, pit stops, safety cars and a deep dive per driver'
              : 'Speed, throttle, brake and gear along the lap'}
          </p>
        </div>
      )}
    </div>
  )
}
