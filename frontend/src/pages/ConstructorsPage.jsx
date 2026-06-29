import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, TeamDot, StatCard, useIsMobile } from '../components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ConstructorImage } from '../components/F1Image'

/* ── helpers ───────────────────────────────────────────────────────────────── */

const MEDAL       = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' }
const MEDAL_LABEL = { 1: '1ST', 2: '2ND', 3: '3RD' }

function hex2rgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* ── Podium card (top 3) ───────────────────────────────────────────────────── */

function PodiumCard({ standing, rank, onClick, selected }) {
  const isFirst = rank === 1
  const color   = standing.color || '#e10600'
  const medal   = MEDAL[rank]

  return (
    <div
      onClick={() => onClick(standing)}
      style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        border: `1px solid ${selected ? color : color + '40'}`,
        boxShadow: selected
          ? `0 0 32px ${color}50, inset 0 0 40px ${color}10`
          : `0 4px 24px ${color}20`,
        transform: isFirst ? 'translateY(-16px)' : 'translateY(0)',
        transition: 'all 0.22s ease',
        animation: `fadeUp 0.4s ease ${rank * 80}ms both`,
        background: `linear-gradient(160deg, ${hex2rgba(color, 0.18)} 0%, #111114 55%)`,
        minHeight: isFirst ? 260 : 220,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = isFirst ? 'translateY(-20px)' : 'translateY(-4px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = isFirst ? 'translateY(-16px)' : 'translateY(0)' }}
    >
      {/* Diagonal accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '60%', height: '100%',
        background: `linear-gradient(135deg, transparent 30%, ${hex2rgba(color, 0.10)} 100%)`,
        pointerEvents: 'none',
      }} />

      {/* Constructor logo — top center */}
      <div style={{
        position: 'absolute', top: 14, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2,
      }}>
        <ConstructorImage
          constructorId={standing.constructorId}
          width={isFirst ? 120 : 96}
          height={isFirst ? 54 : 44}
          color={color}
          name={standing.name}
          style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
        />
      </div>

      {/* Giant position watermark */}
      <div style={{
        position: 'absolute', top: -8, left: 8,
        fontFamily: 'var(--display)', fontSize: isFirst ? 140 : 120,
        lineHeight: 1, color: hex2rgba(color, 0.18),
        letterSpacing: '-0.02em', userSelect: 'none', pointerEvents: 'none',
      }}>
        {rank}
      </div>

      {/* Medal ribbon */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: medal, borderRadius: 6,
        padding: '3px 10px',
        fontFamily: 'var(--display)', fontSize: 11, letterSpacing: '0.08em',
        color: '#000',
      }}>
        {MEDAL_LABEL[rank]}
      </div>

      {/* Points badge */}
      <div style={{
        position: 'absolute', bottom: 52, right: 12,
        background: hex2rgba(color, 0.25),
        border: `1px solid ${color}60`,
        borderRadius: 8, padding: '4px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: 22, lineHeight: 1, color: '#fff' }}>
          {standing.points}
        </span>
        <span style={{ fontSize: 9, color: hex2rgba('#ffffff', 0.6), letterSpacing: '0.1em' }}>PTS</span>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 14px 14px',
        background: `linear-gradient(transparent, ${hex2rgba(color, 0.30)} 100%)`,
        borderTop: `1px solid ${color}30`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 14 }}>{standing.flag}</span>
          <span style={{ fontFamily: 'var(--display)', fontSize: isFirst ? 19 : 16, letterSpacing: '0.06em', color: '#fff' }}>
            {standing.name?.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TeamDot color={color} size={7} />
          <span style={{ fontSize: 11, color: hex2rgba('#ffffff', 0.55) }}>{standing.nationality}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Constructor profile panel ─────────────────────────────────────────────── */

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 12
    }}>
      <div style={{ color: d.payload.color }}>{d.payload.name}</div>
      <div>{d.value} pts</div>
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
    <div style={{
      background: `linear-gradient(145deg, ${hex2rgba(color, 0.12)}, #111114 50%)`,
      border: `1px solid ${color}50`,
      borderRadius: 16, padding: 24,
      position: 'sticky', top: 80,
      animation: 'fadeUp 0.25s ease',
      boxShadow: `0 0 40px ${color}20`,
    }}>
      <button onClick={onClose} style={{
        fontSize: 11, color: 'var(--text-muted)', marginBottom: 16,
        fontFamily: 'var(--mono)', padding: '4px 10px',
        border: '1px solid var(--border)', borderRadius: 6,
        background: 'var(--bg-elevated)',
      }}>✕ close</button>

      {/* Constructor logo hero */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
        <ConstructorImage
          constructorId={standing.constructorId}
          width={130}
          height={60}
          color={color}
          name={standing.name}
          style={{ filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.5))' }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 24 }}>{standing.flag}</span>
            <div style={{
              background: MEDAL[standing.position] || color,
              borderRadius: 8, padding: '2px 12px',
              fontFamily: 'var(--display)', fontSize: 13, color: '#000',
            }}>P{standing.position}</div>
          </div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 26, lineHeight: 1.1, color }}>
            {standing.name}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {standing.nationality}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <StatCard label="Points" value={standing.points} accent={color} />
        <StatCard label="Wins"   value={standing.wins} />
      </div>

      {/* Mini chart */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Constructor comparison
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={allStandings} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'var(--text-muted)', fontFamily: 'var(--mono)' }}
              tickFormatter={n => n.split(' ').map(w => w[0]).join('')}
              axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
            <Bar dataKey="points" radius={[3, 3, 0, 0]}>
              {allStandings.map(entry => (
                <Cell
                  key={entry.constructorId}
                  fill={entry.constructorId === standing.constructorId ? entry.color : '#2a2a30'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data?.constructor?.url && (
        <a href={data.constructor.url} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8,
          fontSize: 12, color: 'var(--text-muted)',
          border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px',
        }}>
          Wikipedia ↗
        </a>
      )}
    </div>
  )
}

/* ── Standing row (P4+) ────────────────────────────────────────────────────── */

function StandingRow({ standing, onClick, selected }) {
  const color = standing.color || '#e10600'
  return (
    <div
      onClick={() => onClick(standing)}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 80px 1fr auto auto',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 10,
        cursor: 'pointer',
        background: selected ? hex2rgba(color, 0.10) : 'var(--bg-card)',
        border: `1px solid ${selected ? color + '60' : 'var(--border)'}`,
        borderLeft: `3px solid ${color}`,
        transition: 'all 0.15s ease',
        animation: `fadeUp 0.35s ease ${standing.position * 25}ms both`,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = hex2rgba(color, 0.07) }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-card)' }}
    >
      <span style={{
        fontFamily: 'var(--display)', fontSize: 22, color: 'var(--text-muted)',
        textAlign: 'center', lineHeight: 1,
      }}>
        {standing.position}
      </span>

      {/* Constructor logo */}
      <ConstructorImage
        constructorId={standing.constructorId}
        width={72}
        height={36}
        color={color}
        name={standing.name}
      />

      <div>
        <div style={{ fontFamily: 'var(--display)', fontSize: 15, letterSpacing: '0.04em', color }}>
          {standing.name?.toUpperCase()}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{standing.nationality}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <TeamDot color={color} size={6} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
          {standing.wins}W
        </span>
      </div>

      <div style={{ textAlign: 'right', minWidth: 52 }}>
        <div style={{ fontFamily: 'var(--display)', fontSize: 20, lineHeight: 1 }}>{standing.points}</div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>PTS</div>
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function ConstructorsPage({ season }) {
  const isMobile = useIsMobile()
  const [selected, setSelected] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['constructor-standings', season],
    queryFn: () => f1Api.getConstructorStandings(season),
  })

  if (isLoading) return <Loader label="Fetching constructor standings..." />
  if (error)     return <ErrorMsg message={error.message} />

  const standings  = data?.standings || []
  const podium     = standings.filter(s => s.position <= 3).sort((a, b) => a.position - b.position)
  const rest       = standings.filter(s => s.position > 3)
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean)

  const toggle = (s) => setSelected(prev => prev?.constructorId === s.constructorId ? null : s)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 4, height: 28, background: 'var(--red)', borderRadius: 2 }} />
          <h2 style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 22 : 32, letterSpacing: '0.06em' }}>
            CONSTRUCTOR STANDINGS
          </h2>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            padding: '2px 8px', borderRadius: 4,
          }}>
            {data?.round ? `Round ${data.round}` : season}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 14 }}>
          {standings.length} teams · {season} season
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected && !isMobile ? '1fr 360px' : '1fr', gap: 24 }}>
        <div>
          {/* Podium top 3 */}
          {podium.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 12, marginBottom: 20,
              alignItems: isMobile ? 'stretch' : 'flex-end',
            }}>
              {(isMobile ? podium : podiumOrder).map(s => (
                <PodiumCard
                  key={s.constructorId}
                  standing={s}
                  rank={s.position}
                  selected={selected?.constructorId === s.constructorId}
                  onClick={toggle}
                />
              ))}
            </div>
          )}

          {/* Divider */}
          {rest.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 14px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
                REMAINING CONSTRUCTORS
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          )}

          {/* P4+ rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rest.map(s => (
              <StandingRow
                key={s.constructorId}
                standing={s}
                selected={selected?.constructorId === s.constructorId}
                onClick={toggle}
              />
            ))}
          </div>
        </div>

        {/* Profile panel */}
        {selected && !isMobile && (
          <ConstructorProfile
            standing={selected}
            season={season}
            allStandings={standings}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {/* Mobile full-width profile */}
      {selected && isMobile && (
        <div style={{ marginTop: 20 }}>
          <ConstructorProfile
            standing={selected}
            season={season}
            allStandings={standings}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  )
}
