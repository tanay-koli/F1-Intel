import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { f1Api } from '../api'
import { CURRENT_SEASON } from '../hooks/useSeason'
import { Loader, ErrorMsg, SectionHeader, TeamDot, useIsMobile } from '../components/ui'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 7, color: disabled ? 'var(--text-dim)' : 'var(--text)',
          padding: '7px 12px', fontFamily: 'var(--body)', fontSize: 13,
          cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none',
          minWidth: 130, appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b6b7a'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
          paddingRight: 28,
          transition: 'border-color 0.15s',
        }}
      >
        {children}
      </select>
    </div>
  )
}

function DriverCard({ driver, label, extra }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--bg-elevated)', border: `1px solid ${driver.teamColor}40`,
      borderLeft: `3px solid ${driver.teamColor}`,
      borderRadius: 8, padding: '10px 14px',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: `${driver.teamColor}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--display)', fontSize: 13, color: driver.teamColor,
        flexShrink: 0,
      }}>
        {driver.code}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--body)' }}>{label}</div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{driver.fullName}</div>
        {driver.lapTime && (
          <div style={{ fontFamily: 'var(--body)', fontSize: 11, color: driver.teamColor }}>
            ⏱ {driver.lapTime}
          </div>
        )}
        {extra}
      </div>
    </div>
  )
}

function StatPill({ label, value, color, highlight }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: highlight ? '#FFD70012' : 'var(--bg-elevated)',
      border: `1px solid ${highlight ? '#FFD70040' : 'var(--border)'}`,
      borderRadius: 20, padding: '4px 12px', fontSize: 11,
    }}>
      {color && <TeamDot color={color} size={7} />}
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--body)', color: highlight ? '#FFD700' : (color ?? 'var(--text)'), fontWeight: 600 }}>{value}</span>
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
    <div style={{ position: 'relative', height, borderRadius: 4, overflow: 'hidden', background: '#1a1a20' }}>
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
      borderRadius: 10, padding: '12px 16px', marginBottom: 16,
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
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, overflow: 'auto', marginBottom: 20,
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--body)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
            <th style={thStyle}>Grid</th>
            <th style={thStyle}>Pos</th>
            <th style={{ ...thStyle, textAlign: 'left', minWidth: 130 }}>Driver</th>
            <th style={{ ...thStyle, textAlign: 'left', minWidth: 100 }}>Team</th>
            <th style={thStyle}>Fastest Lap</th>
            <th style={thStyle}>Avg Lap</th>
            <th style={thStyle}>Stops</th>
            <th style={{ ...thStyle, textAlign: 'left', minWidth: 140 }}>Strategy</th>
            <th style={thStyle}>Laps</th>
            <th style={thStyle}>+/-</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map(d => {
            const isFL = fl.driver === d.code
            const isSelected = selectedDriver === d.code
            return (
              <tr
                key={d.code}
                onClick={() => onSelectDriver(d.code)}
                style={{
                  borderBottom: '1px solid #1e1e24',
                  background: isSelected ? `${d.teamColor}15` : isFL ? '#FFD70008' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = `${d.teamColor}0a` }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isFL ? '#FFD70008' : 'transparent' }}
              >
                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{d.gridPosition ?? '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <span style={{
                    fontWeight: 700,
                    color: d.finishPosition === 1 ? '#FFD700' : d.finishPosition === 2 ? '#C0C0C0' : d.finishPosition === 3 ? '#CD7F32' : 'var(--text)',
                  }}>
                    P{d.finishPosition ?? '—'}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TeamDot color={d.teamColor} size={7} />
                    <span style={{ color: d.teamColor, fontWeight: 600 }}>{d.code}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{d.fullName}</span>
                  </div>
                </td>
                <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--text-dim)', fontSize: 12 }}>{d.team}</td>
                <td style={{ ...tdStyle, textAlign: 'center', color: isFL ? '#FFD700' : 'var(--text)' }}>
                  {d.fastestLapTimeStr}
                  {isFL && <span style={{ marginLeft: 4, fontSize: 12 }}>FL</span>}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{d.avgLapTimeStr}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{d.pitStops}</td>
                <td style={{ ...tdStyle, textAlign: 'left' }}>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {d.stints.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }} title={`${s.compound} L${s.startLap}–${s.endLap} (${s.length} laps)`}>
                        <span style={{
                          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                          background: COMPOUND_COLORS[s.compound] ?? '#888',
                        }} />
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{s.length}</span>
                        {i < d.stints.length - 1 && <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>→</span>}
                      </div>
                    ))}
                  </div>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{d.totalLaps}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  {d.positionsGained != null ? (
                    <span style={{
                      color: d.positionsGained > 0 ? '#39B54A' : d.positionsGained < 0 ? '#E8002D' : 'var(--text-dim)',
                      fontWeight: 600,
                    }}>
                      {d.positionsGained > 0 ? `+${d.positionsGained}` : d.positionsGained}
                    </span>
                  ) : '—'}
                </td>
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
      borderRadius: 12, padding: '16px', marginBottom: 20,
    }}>
      <div style={{
        fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
      }}>
        Position Chart · All Drivers · Lap by Lap →
      </div>
      <ResponsiveContainer width="100%" height={isMobile ? 280 : 380}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#2a2a30" strokeDasharray="3 3" />
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
        ↑ P1 (leader) is at top. Click a row in the table above to highlight a driver.
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
            color: drv?.teamColor ?? 'var(--text)', marginBottom: 2,
          }}>
            <span>{p.dataKey}</span>
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
      borderRadius: 12, padding: '16px', marginBottom: 20,
    }}>
      <div style={{
        fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
      }}>
        ⏱ Lap Times · All Drivers →
      </div>
      <ResponsiveContainer width="100%" height={isMobile ? 260 : 340}>
        <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#2a2a30" strokeDasharray="3 3" />
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
      <div style={{ color: d.teamColor, fontWeight: 600, marginBottom: 4 }}>
        {d.code} · Lap {d.lap}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: COMPOUND_COLORS[d.compound] ?? '#888',
        }} />
        <span style={{ color: 'var(--text)' }}>{fmtSecs(d.lapTime)}</span>
        {d.isPitLap && <span style={{ color: '#FFA500' }}>Pit</span>}
      </div>
    </div>
  )
}

function AllDriversTyreStrategy({ analysis, isMobile }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px', marginBottom: 20,
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
                fontFamily: 'var(--body)', fontSize: 11, color: d.teamColor,
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
        background: '#e1060008',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: 'var(--red)', borderRadius: 5, padding: '2px 8px',
              fontFamily: 'var(--display)', fontSize: 12,
              color: '#fff',
            }}>Analyst</span>
            <span style={{
              fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)',
            }}>Race Analyst</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              id="analyst-play-btn"
              onClick={() => setIsPlaying(p => !p)}
              style={{
                background: isPlaying ? '#e1060020' : 'var(--bg-elevated)',
                border: `1px solid ${isPlaying ? '#e1060060' : 'var(--border)'}`,
                borderRadius: 6, padding: '4px 12px',
                color: isPlaying ? 'var(--red)' : 'var(--text-muted)',
                fontFamily: 'var(--body)', fontSize: 11,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <div style={{
              fontFamily: 'var(--display)', fontSize: 22, color: 'var(--text)',
              minWidth: 80, textAlign: 'right',
            }}>
              <span style={{ color: 'var(--red)' }}>L{currentLap}</span>
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
            width: `${progress}%`, background: 'var(--red)',
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
  const fl = analysis.overallFastestLap

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      {/* Race Banner */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '14px 18px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 22 }}>{analysis.raceName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--body)' }}>
            {analysis.year} · Round {analysis.round} · Race · {analysis.totalLaps} Laps
          </div>
        </div>
        {fl.driver && (
          <div style={{
            background: '#FFD70012', border: '1px solid #FFD70030', borderRadius: 8,
            padding: '6px 12px', fontSize: 12, fontFamily: 'var(--body)', color: '#FFD700',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span><strong>{fl.driver}</strong> · {fl.timeStr} · L{fl.lap} · {fl.compound}</span>
          </div>
        )}
      </div>

      {/* Race Events */}
      <RaceEventsBanner events={analysis.raceEvents} totalLaps={analysis.totalLaps} />

      {/* Race Analyst Panel */}
      {analystInsights && analystInsights.length > 0 && (
        <RaceAnalystPanel insights={analystInsights} totalLaps={analysis.totalLaps} isMobile={isMobile} />
      )}

      {/* Section Header */}
      <div style={{
        fontFamily: 'var(--display)', fontSize: 18, letterSpacing: '0.04em',
        color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        Full Race Overview
        <span style={{
          fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)',
          background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4,
          border: '1px solid var(--border)',
        }}>{analysis.drivers.length} drivers</span>
      </div>

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
      {/* Section Header */}
      <div style={{
        fontFamily: 'var(--display)', fontSize: 18, letterSpacing: '0.04em',
        color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        Driver Deep Dive
      </div>

      {/* Driver Header Card */}
      <div style={{
        background: 'var(--bg-elevated)', border: `1px solid ${driver.teamColor}40`,
        borderLeft: `4px solid ${driver.teamColor}`,
        borderRadius: 10, padding: '16px 20px', marginBottom: 16,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: '50%',
          background: `${driver.teamColor}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--display)', fontSize: 16, color: driver.teamColor,
        }}>
          {driver.code}
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 20, color: 'var(--text)' }}>{driver.fullName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--body)' }}>{driver.team}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)' }}>Grid</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 22, color: 'var(--text-muted)' }}>P{driver.gridPosition ?? '—'}</div>
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: 16 }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-dim)' }}>Finish</div>
            <div style={{
              fontFamily: 'var(--display)', fontSize: 22,
              color: driver.finishPosition <= 3 ? '#FFD700' : 'var(--text)',
            }}>P{driver.finishPosition ?? '—'}</div>
          </div>
          {driver.positionsGained != null && (
            <div style={{
              fontFamily: 'var(--body)', fontSize: 14, fontWeight: 700,
              color: driver.positionsGained > 0 ? '#39B54A' : driver.positionsGained < 0 ? '#E8002D' : 'var(--text-dim)',
              background: driver.positionsGained > 0 ? '#39B54A15' : driver.positionsGained < 0 ? '#E8002D15' : 'transparent',
              border: `1px solid ${driver.positionsGained > 0 ? '#39B54A40' : driver.positionsGained < 0 ? '#E8002D40' : 'var(--border)'}`,
              borderRadius: 6, padding: '4px 10px',
            }}>
              {driver.positionsGained > 0 ? `▲ ${driver.positionsGained}` : driver.positionsGained < 0 ? `▼ ${Math.abs(driver.positionsGained)}` : '—'}
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
        background: isRaceFL ? '#FFD70008' : 'var(--bg-card)',
        border: `1px solid ${isRaceFL ? '#FFD70030' : 'var(--border)'}`,
        borderRadius: 10, padding: '14px 18px', marginBottom: 20,
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
            <div style={{ fontFamily: 'var(--display)', fontSize: 20, color: driver.teamColor }}>L{driver.fastestLap ?? '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)' }}>Time</div>
            <div style={{ fontFamily: 'var(--body)', fontSize: 16, color: isRaceFL ? '#FFD700' : 'var(--text)' }}>
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
              color: isRaceFL ? '#FFD700' : flDeltaToRace && Number(flDeltaToRace) > 0 ? '#E8002D' : '#39B54A',
            }}>
              {isRaceFL ? '— HOLDER' : flDeltaToRace ? `+${flDeltaToRace}s` : 'N/A'}
            </div>
          </div>
        </div>
        {flDeltaToAvg && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--body)' }}>
            Their FL was <strong style={{ color: '#39B54A' }}>{flDeltaToAvg}s faster</strong> than their average lap ({driver.avgLapTimeStr})
          </div>
        )}
      </div>

      {/* Tyre Strategy Band */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '14px 16px', marginBottom: 20,
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
        borderRadius: 12, padding: '16px', marginBottom: 20,
      }}>
        <div style={{
          fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
        }}>
          ⏱ Lap Times · {driver.code} →
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={lapChartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#2a2a30" strokeDasharray="3 3" />
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
              <ReferenceLine key={`pit-${lap}`} x={lap} stroke="#FFA500" strokeDasharray="3 3" strokeOpacity={0.6} />
            ))}
            {/* Fastest lap reference */}
            {driver.fastestLap && (
              <ReferenceLine x={driver.fastestLap} stroke="#FFD700" strokeDasharray="4 2" strokeOpacity={0.8} />
            )}
            <Line
              type="monotone" dataKey="lapTime"
              stroke={driver.teamColor} strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props
                if (!cx || !cy) return null
                if (payload.isFastestLap) {
                  return <circle cx={cx} cy={cy} r={5} fill="#FFD700" stroke="#FFD700" strokeWidth={2} />
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
            <div style={{ width: 16, height: 0, borderTop: '2px dashed #FFA500', opacity: 0.6 }} /> Pit Stop
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--body)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFD700' }} /> FL
          </div>
        </div>
      </div>

      {/* Position Progression Chart */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '16px', marginBottom: 20,
      }}>
        <div style={{
          fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
        }}>
          Position Progression · {driver.code} →
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={driver.laps.filter(l => l.lap && l.position)} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id={`posGrad-${driver.code}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={driver.teamColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={driver.teamColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2a2a30" strokeDasharray="3 3" />
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
              <ReferenceLine key={`pit-${lap}`} x={lap} stroke="#FFA500" strokeDasharray="3 3" strokeOpacity={0.5} />
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
                  background: isFL ? '#FFD70010' : l.isPitLap ? '#FFA50008' : 'transparent',
                }}>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{l.lap}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: isFL ? '#FFD700' : 'var(--text)' }}>
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
                    {isFL && <span style={{ color: '#FFD700', marginRight: 4 }}>FL</span>}
                    {l.isPitLap && <span style={{ color: '#FFA500', marginRight: 4 }}>PIT</span>}
                    {isSC && <span style={{ color: '#FFA500', marginRight: 4 }}>SC</span>}
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
        <span style={{ color: d.isFastestLap ? '#FFD700' : driver.teamColor, fontWeight: 600 }}>
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
      <div style={{ color: driver.teamColor, fontWeight: 600 }}>P{payload[0]?.value ?? '—'}</div>
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
        <CartesianGrid stroke="#2a2a30" strokeDasharray="3 3" />
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
        borderRadius: 10, padding: '12px 18px', marginBottom: 20,
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
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {METRIC_TABS.map(t => (
          <button
            key={t.id}
            id={`metric-tab-${t.id}`}
            onClick={() => setMetric(t.id)}
            style={{
              padding: '6px 14px', borderRadius: 7,
              background: metric === t.id ? 'var(--bg-elevated)' : 'transparent',
              border: `1px solid ${metric === t.id ? 'var(--border)' : 'transparent'}`,
              color: metric === t.id ? 'var(--text)' : 'var(--text-muted)',
              fontSize: 13, fontFamily: 'var(--body)',
              borderBottom: metric === t.id ? '2px solid var(--red)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.12s',
            }}
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
        borderRadius: 12, padding: '16px',
      }}>
        <div style={{
          fontFamily: 'var(--body)', fontSize: 12,
          color: 'var(--text-muted)', marginBottom: 12,
        }}>
          {METRIC_TABS.find(t => t.id === metric)?.label} · Distance →
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          {[tel.driver1, tel.driver2].map(d => (
            <div key={d.code} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 2, background: d.teamColor, borderRadius: 1 }} />
              <span style={{ fontFamily: 'var(--body)', fontSize: 11, color: d.teamColor }}>
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
                background: 'var(--bg-card)', border: 'var(--border)',
                borderRadius: 10, padding: '12px',
                cursor: 'pointer',
                outline: metric === t.id ? '2px solid var(--red)' : 'none',
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

      {/* Info banner */}
      <div style={{
        background: '#3671C615', border: '1px solid #3671C640',
        borderRadius: 8, padding: '10px 14px', marginBottom: 20,
        fontSize: 12, color: '#a0c4ff', fontFamily: 'var(--body)',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <span>
          Powered by <strong>OpenF1</strong> (2023 on) and <strong>FastF1</strong> (2021–22).
          First load for a session may take 10–60s while the data is downloaded. Subsequent loads are instant.
        </span>
      </div>

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {VIEW_TABS.map(t => (
          <button
            key={t.id}
            id={`view-tab-${t.id}`}
            onClick={() => setViewTab(t.id)}
            style={{
              padding: '8px 18px', borderRadius: '8px 8px 0 0',
              background: viewTab === t.id ? 'var(--bg-card)' : 'transparent',
              border: viewTab === t.id ? '1px solid var(--border)' : '1px solid transparent',
              borderBottom: viewTab === t.id ? '1px solid var(--bg-card)' : '1px solid transparent',
              marginBottom: -1,
              color: viewTab === t.id ? 'var(--text)' : 'var(--text-muted)',
              fontSize: 13, fontFamily: 'var(--body)', fontWeight: viewTab === t.id ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RACE ANALYSIS SELECTOR ── */}
      {viewTab === 'analysis' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 24,
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
        }}>
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
            onClick={handleLoadAnalysis}
            disabled={analysisLoading}
            style={{
              padding: '8px 20px', borderRadius: 8,
              background: !analysisLoading ? 'var(--red)' : 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: !analysisLoading ? '#fff' : 'var(--text-dim)',
              fontFamily: 'var(--body)', fontWeight: 600, fontSize: 13,
              cursor: !analysisLoading ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s', alignSelf: 'flex-end',
              minWidth: 140,
            }}
          >
            {analysisLoading ? '⏳ Loading…' : '▶ Load Analysis'}
          </button>

          {/* Deep Dive driver selector — only shows after data loads */}
          {analysisData && !analysisLoading && (
            <SelectBox
              label="DEEP DIVE DRIVER"
              value={selectedDriver}
              onChange={setSelectedDriver}
            >
              <option value="">— select driver —</option>
              {analysisData.drivers.map(d => (
                <option key={d.code} value={d.code}>P{d.finishPosition ?? '?'} · {d.code} — {d.fullName}</option>
              ))}
            </SelectBox>
          )}
        </div>
      )}

      {/* ── FASTEST LAP TRACE SELECTOR ── */}
      {viewTab === 'fastlap' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 24,
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
        }}>
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
            label="DRIVER 1"
            value={driver1}
            onChange={setDriver1}
            disabled={driversLoading || driverList.length === 0}
          >
            <option value="">— pick driver —</option>
            {driverList.filter(d => d.driverId !== driver2).map(d => (
              <option key={d.driverId} value={d.driverId}>{d.code} — {d.fullName}</option>
            ))}
          </SelectBox>

          <SelectBox
            label="DRIVER 2"
            value={driver2}
            onChange={setDriver2}
            disabled={driversLoading || driverList.length === 0}
          >
            <option value="">— pick driver —</option>
            {driverList.filter(d => d.driverId !== driver1).map(d => (
              <option key={d.driverId} value={d.driverId}>{d.code} — {d.fullName}</option>
            ))}
          </SelectBox>

          <button
            id="load-telemetry-btn"
            onClick={handleLoadFastlap}
            disabled={!canLoadFastlap || telLoading}
            style={{
              padding: '8px 20px', borderRadius: 8,
              background: canLoadFastlap && !telLoading ? 'var(--red)' : 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: canLoadFastlap && !telLoading ? '#fff' : 'var(--text-dim)',
              fontFamily: 'var(--body)', fontWeight: 600, fontSize: 13,
              cursor: canLoadFastlap && !telLoading ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s', alignSelf: 'flex-end',
              minWidth: 100,
            }}
          >
            {telLoading ? '⏳ Loading…' : '▶ Load'}
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
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: 'var(--text-muted)', fontFamily: 'var(--body)', fontSize: 13,
        }}>
          <div>
            {viewTab === 'analysis'
              ? <>Select a year and round, then click <strong style={{ color: 'var(--text)' }}>▶ Load Analysis</strong> for full race breakdown</>
              : <>Select two drivers and click <strong style={{ color: 'var(--text)' }}>▶ Load</strong> to compare fastest lap telemetry</>
            }
          </div>
          {viewTab === 'analysis' && (
            <div style={{ fontSize: 11, marginTop: 8, color: 'var(--text-dim)' }}>
              All Drivers · Positions · Lap Times · Tyre Strategy · Pit Stops · Safety Cars · Deep Dive Analysis
            </div>
          )}
          {viewTab === 'fastlap' && (
            <div style={{ fontSize: 11, marginTop: 8, color: 'var(--text-dim)' }}>
              Speed · Throttle · Brake · Gear — all channels from official F1 timing data
            </div>
          )}
        </div>
      )}
    </div>
  )
}
