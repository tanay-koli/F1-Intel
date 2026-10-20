import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { f1Api } from '../api'
import { Loader, ErrorMsg, SectionHeader, TeamDot } from '../components/ui'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].sort((a, b) => b.value - a.value)
  return (
    <div style={{
      background: '#18181c', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: 'var(--mono)', fontSize: 11,
      maxHeight: 240, overflowY: 'auto'
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {sorted.map(p => (
        <div key={p.dataKey} style={{
          display: 'flex', justifyContent: 'space-between',
          gap: 14, color: p.stroke, marginBottom: 3
        }}>
          <span>{p.dataKey}</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{p.value} pts</span>
        </div>
      ))}
    </div>
  )
}

function buildChartData(rounds, series) {
  return rounds.map((r, i) => {
    const row = { round: r }
    series.forEach(s => {
      row[s.code || s.name] = s.points[i]
    })
    return row
  })
}

function DriverProgressionChart({ season }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['driver-progression', season],
    queryFn: () => f1Api.getDriverProgression(season)
  })

  if (isLoading) return <Loader label="Building driver points chart..." />
  if (error) return <ErrorMsg error={error} />
  if (!data?.rounds?.length) return (
    <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12, padding: 20 }}>
      No race data available yet for {season}.
    </div>
  )

  const chartData = buildChartData(data.rounds, data.series)

  return (
    <div>
      {/* Legend pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {data.series.map(s => (
          <div key={s.driverId} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '3px 10px', fontSize: 11
          }}>
            <TeamDot color={s.teamColor} size={7} />
            <span style={{ fontFamily: 'var(--mono)', color: s.teamColor }}>{s.code}</span>
            <span style={{ color: 'var(--text-muted)' }}>{s.points[s.points.length - 1]}pts</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke="#2a2a30" strokeDasharray="3 3" />
          <XAxis
            dataKey="round"
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--mono)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--mono)' }}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {data.series.map(s => (
            <Line
              key={s.driverId}
              type="monotone"
              dataKey={s.code}
              stroke={s.teamColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: s.teamColor }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ConstructorProgressionChart({ season }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['constructor-progression', season],
    queryFn: () => f1Api.getConstructorProgression(season)
  })

  if (isLoading) return <Loader label="Building constructor points chart..." />
  if (error) return <ErrorMsg error={error} />
  if (!data?.rounds?.length) return (
    <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12, padding: 20 }}>
      No race data available yet for {season}.
    </div>
  )

  const chartData = buildChartData(data.rounds, data.series)

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {data.series.map(s => (
          <div key={s.constructorId} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '3px 10px', fontSize: 11
          }}>
            <TeamDot color={s.color} size={7} />
            <span style={{ fontFamily: 'var(--mono)', color: s.color, fontSize: 11 }}>{s.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>{s.points[s.points.length - 1]}pts</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke="#2a2a30" strokeDasharray="3 3" />
          <XAxis
            dataKey="round"
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--mono)' }}
            axisLine={{ stroke: 'var(--border)' }} tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--mono)' }}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {data.series.map(s => (
            <Line
              key={s.constructorId}
              type="monotone"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: s.color }}
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

  const tabs = [
    { id: 'drivers',      label: '🏎 Driver Championship'      },
    { id: 'constructors', label: '🏭 Constructor Championship'  },
  ]

  return (
    <div>
      <SectionHeader title="Championship" count={`${season} season arc`} />

      {/* Info banner */}
      <div style={{
        background: '#3671C620', border: '1px solid #3671C640',
        borderRadius: 8, padding: '10px 14px', marginBottom: 20,
        fontSize: 12, color: '#a0c4ff', fontFamily: 'var(--mono)'
      }}>
        ℹ Points progression fetches standings after each completed round.
        Large seasons (20+ rounds) may take a few seconds.
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            style={{
              padding: '7px 16px', borderRadius: 7,
              background: view === t.id ? 'var(--bg-elevated)' : 'transparent',
              border: `1px solid ${view === t.id ? 'var(--border)' : 'transparent'}`,
              color: view === t.id ? 'var(--text)' : 'var(--text-muted)',
              fontSize: 13, fontFamily: 'var(--body)',
              borderBottom: view === t.id ? '2px solid var(--red)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.12s'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '20px 16px'
      }}>
        {view === 'drivers'      && <DriverProgressionChart season={season} />}
        {view === 'constructors' && <ConstructorProgressionChart season={season} />}
      </div>
    </div>
  )
}
