import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, useIsMobile } from '../components/ui'

/* ── Status helpers ────────────────────────────────────────────────────────── */

const STATUS = {
  past:     { label: 'Completed', color: '#27F4D2', bg: '#27f4d215' },
  next:     { label: 'Next Race', color: '#e10600', bg: '#e1060020', pulse: true },
  upcoming: { label: 'Upcoming',  color: '#6b6b7a', bg: 'transparent' },
}

function getStatus(dateStr, nextRoundIdx, idx) {
  if (!dateStr) return 'upcoming'
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr < today) return 'past'
  if (idx === nextRoundIdx) return 'next'
  return 'upcoming'
}

/* ── Map panel ─────────────────────────────────────────────────────────────── */

function MapPanel({ lat, lng, name }) {
  const mapUrl  = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.05},${lat - 0.05},${lng + 0.05},${lat + 0.05}&layer=mapnik&marker=${lat},${lng}`
  const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`

  return (
    <div>
      <div style={{ height: 180, background: '#0d1117', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
        <iframe
          src={mapUrl}
          style={{ width: '100%', height: '100%', border: 'none', filter: 'invert(0.9) hue-rotate(180deg) contrast(0.85)' }}
          title={name}
        />
      </div>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderTop: 'none', borderRadius: '0 0 8px 8px',
        padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 11,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: 'var(--text-muted)' }}>{lat.toFixed(4)}° · {lng.toFixed(4)}°</span>
        <a href={osmLink} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--text-muted)', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4 }}>
          Map ↗
        </a>
      </div>
    </div>
  )
}

/* ── Session pill ──────────────────────────────────────────────────────────── */

function SessionPill({ label, date, isRace }) {
  if (!date) return null
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: isRace ? 'var(--text)' : 'var(--text-muted)' }}>
      <span style={{
        background: isRace ? '#e1060020' : 'var(--bg-elevated)',
        border: `1px solid ${isRace ? '#e1060060' : 'var(--border)'}`,
        color: isRace ? 'var(--red)' : 'inherit',
        borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--mono)', fontSize: 10,
      }}>{label}</span>
      <span style={{ fontWeight: isRace ? 600 : 400 }}>{date}</span>
    </div>
  )
}

/* ── Race row ──────────────────────────────────────────────────────────────── */

function RaceRow({ race, status, onClick, selected }) {
  const s = STATUS[status]
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 44px 1fr auto',
        alignItems: 'center', gap: 14,
        padding: '14px 18px',
        background: selected ? 'var(--bg-elevated)' : status === 'next' ? '#e1060008' : 'var(--bg-card)',
        border: `1px solid ${selected ? '#e1060050' : status === 'next' ? '#e1060030' : 'var(--border)'}`,
        borderLeft: `3px solid ${s.color}`,
        borderRadius: 10, cursor: 'pointer',
        transition: 'all 0.15s',
        animation: 'fadeUp 0.3s ease both',
        animationDelay: `${race.round * 20}ms`,
        opacity: status === 'upcoming' && !selected ? 0.7 : 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#e1060040' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = selected ? '#e1060050' : status === 'next' ? '#e1060030' : 'var(--border)' }}
    >
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: s.color, textAlign: 'center' }}>
        R{race.round}
      </div>
      <div style={{
        width: 40, height: 40, borderRadius: 8,
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>
        {race.flag}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{race.raceName}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {race.circuitName} · {race.locality}, {race.country}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: status === 'past' ? 'var(--text-muted)' : s.color }}>
          {race.date}
        </div>
        <div style={{
          fontSize: 10, marginTop: 3, background: s.bg, color: s.color,
          padding: '1px 6px', borderRadius: 4, display: 'inline-block',
          fontFamily: 'var(--mono)',
          animation: s.pulse ? 'pulse-red 1.5s infinite' : 'none',
        }}>
          {s.label}
        </div>
      </div>
    </div>
  )
}

/* ── Race detail panel ─────────────────────────────────────────────────────── */

function RaceDetail({ race, onClose }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderTop: '3px solid var(--red)', borderRadius: 12, overflow: 'hidden',
      position: 'sticky', top: 80, animation: 'fadeUp 0.25s ease',
    }}>
      {race.lat && race.lng && (
        <MapPanel lat={race.lat} lng={race.lng} name={race.circuitName} />
      )}

      <div style={{ padding: '20px' }}>
        <button onClick={onClose} style={{
          fontSize: 11, color: 'var(--text-muted)', marginBottom: 14,
          fontFamily: 'var(--mono)', padding: '4px 10px',
          border: '1px solid var(--border)', borderRadius: 6,
          background: 'var(--bg-elevated)',
        }}>✕ close</button>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 26 }}>{race.flag}</span>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>ROUND {race.round}</div>
        </div>
        <div style={{ fontFamily: 'var(--display)', fontSize: 28, lineHeight: 1.1, marginBottom: 4 }}>{race.raceName}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>{race.circuitName}</div>

        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '12px 16px', fontFamily: 'var(--mono)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.08em' }}>SESSIONS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SessionPill label="FP1"  date={race.fp1} />
            <SessionPill label="FP2"  date={race.fp2} />
            <SessionPill label="FP3"  date={race.fp3} />
            {race.sprint && <SessionPill label="SPR" date={race.sprint} />}
            <SessionPill label="QUAL" date={race.qualifying} />
            <SessionPill label="RACE" date={`${race.date}${race.time ? ` · ${race.time.slice(0, 5)} UTC` : ''}`} isRace />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function SchedulePage({ season }) {
  const isMobile = useIsMobile()
  const [selected, setSelected] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['schedule', season],
    queryFn: () => f1Api.getSchedule(season),
  })

  if (isLoading) return <Loader label="Fetching race calendar..." />
  if (error)     return <ErrorMsg message={error.message} />

  const races   = data?.races || []
  const today   = new Date().toISOString().slice(0, 10)
  const nextIdx = races.findIndex(r => r.date >= today)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 4, height: 28, background: 'var(--red)', borderRadius: 2 }} />
          <h2 style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 24 : 32, letterSpacing: '0.06em' }}>
            RACE CALENDAR
          </h2>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            padding: '2px 8px', borderRadius: 4,
          }}>
            {races.length} rounds · {season}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected && !isMobile ? '1fr 360px' : '1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {races.map((race, idx) => {
            const status = getStatus(race.date, nextIdx, idx)
            return (
              <RaceRow
                key={race.round}
                race={race}
                status={status}
                selected={selected?.round === race.round}
                onClick={() => setSelected(selected?.round === race.round ? null : race)}
              />
            )
          })}
        </div>

        {selected && !isMobile && (
          <RaceDetail race={selected} onClose={() => setSelected(null)} />
        )}
      </div>

      {/* Mobile detail panel — below list */}
      {selected && isMobile && (
        <div style={{ marginTop: 16 }}>
          <RaceDetail race={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  )
}
