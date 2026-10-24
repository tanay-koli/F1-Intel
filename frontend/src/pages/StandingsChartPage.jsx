import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { f1Api } from '../api'
import { Loader, ErrorMsg, SectionHeader } from '../components/ui'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import { points } from '../lib/format'
import { GRID, AXIS, tick } from '../lib/chartTheme'
import styles from './ranked.module.css'
import chart from '../components/chart.module.css'

const DASH = '6 4'

const VIEWS = {
  drivers: {
    label: 'Drivers',
    queryKey: 'driver-progression',
    fetch: f1Api.getDriverProgression,
    id: s => s.driverId,
    name: s => s.code || s.fullName,
    color: s => s.teamColor,
  },
  constructors: {
    label: 'Constructors',
    queryKey: 'constructor-progression',
    fetch: f1Api.getConstructorProgression,
    id: s => s.constructorId,
    name: s => s.name,
    color: s => s.color,
  },
}

/** Round ticks from 0 to one step above the maximum, five at most. */
function niceTicks(max) {
  const step = [5, 10, 25, 50, 100, 200, 500, 1000].find(s => max / s <= 4) ?? 1000
  const top = (Math.floor(max / step) + 1) * step
  return Array.from({ length: top / step + 1 }, (_, i) => i * step)
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].sort((a, b) => b.value - a.value)
  return (
    <div className={chart.tooltip}>
      <div className={chart.tooltipLabel}>{label}</div>
      {sorted.map(p => (
        <div key={p.dataKey} className={chart.tooltipRow}>
          <span>{p.dataKey}</span>
          <span className={chart.tooltipValue}>{points(p.value)} pts</span>
        </div>
      ))}
    </div>
  )
}

/** The legend swatch is the line itself: team colour, dashed for a team's second entry. */
function Swatch({ color, dashed }) {
  return (
    <svg width="18" height="4" aria-hidden="true">
      <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
    </svg>
  )
}

function ProgressionChart({ season, view }) {
  const v = VIEWS[view]
  const { data, isLoading, error } = useQuery({
    queryKey: [v.queryKey, season],
    queryFn: () => v.fetch(season)
  })

  if (isLoading) return <Loader label="Building the points chart..." />
  if (error) return <ErrorMsg error={error} />
  if (!data?.rounds?.length) return (
    <p className={styles.message}>No race data available yet for {season}.</p>
  )

  // Teammates share a colour, so the lower-placed one gets a dashed line.
  const seen = new Set()
  const series = data.series.map(s => {
    const color = v.color(s)
    const dashed = seen.has(color)
    seen.add(color)
    return { key: v.id(s), name: v.name(s), color, dashed, points: s.points }
  })

  const chartData = data.rounds.map((round, i) => {
    const row = { round }
    series.forEach(s => { row[s.name] = s.points[i] })
    return row
  })
  const max = Math.max(0, ...series.flatMap(s => s.points.filter(p => p != null)))
  const ticks = niceTicks(max)

  return (
    <div>
      <ul className={chart.legend}>
        {series.map(s => (
          <li key={s.key} className={chart.legendItem}>
            <Swatch color={s.color} dashed={s.dashed} />
            <span className={chart.legendName}>{s.name}</span>
            <span className={chart.legendValue}>{points(s.points[s.points.length - 1] ?? 0)} pts</span>
          </li>
        ))}
      </ul>

      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="round"
            tick={tick}
            axisLine={{ stroke: AXIS }}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            ticks={ticks}
            domain={[0, ticks[ticks.length - 1]]}
            tick={tick}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {series.map(s => (
            <Line
              key={s.key}
              type="linear"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? DASH : undefined}
              dot={false}
              activeDot={{ r: 4, fill: s.color }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function StandingsChartPage({ season }) {
  // ?view=constructors (e.g. from Home's Constructors panel) opens that tab
  const [searchParams] = useSearchParams()
  const [view, setView] = useState(searchParams.get('view') === 'constructors' ? 'constructors' : 'drivers')

  return (
    <div>
      <SectionHeader title="Points through the season" count={season} />

      <div className={styles.tabs}>
        {Object.entries(VIEWS).map(([id, v]) => (
          <button
            key={id}
            type="button"
            className={styles.tab}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className={chart.card}>
        <ProgressionChart key={view} season={season} view={view} />
      </div>
    </div>
  )
}
