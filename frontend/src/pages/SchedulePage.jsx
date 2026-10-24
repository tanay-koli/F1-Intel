import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, useIsMobile } from '../components/ui'
import SectionHeading from '../components/SectionHeading'
import { weekendRange } from '../lib/format'
import styles from './ranked.module.css'

/* ── Status helpers ────────────────────────────────────────────────────────── */

function getStatus(dateStr, nextRoundIdx, idx) {
  if (!dateStr) return 'upcoming'
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr < today) return 'past'
  if (idx === nextRoundIdx) return 'next'
  return 'upcoming'
}

const STATUS_LABEL = { past: 'Completed', upcoming: 'Upcoming' }

/* ── Map panel ─────────────────────────────────────────────────────────────── */

function MapPanel({ lat, lng, name }) {
  const mapUrl  = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.05},${lat - 0.05},${lng + 0.05},${lat + 0.05}&layer=mapnik&marker=${lat},${lng}`
  const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`

  return (
    <div style={{ margin: '-20px -20px 16px' }}>
      <div style={{ height: 180, background: '#0d1117', overflow: 'hidden' }}>
        <iframe
          src={mapUrl}
          style={{ width: '100%', height: '100%', border: 'none', filter: 'invert(0.9) hue-rotate(180deg) contrast(0.85)' }}
          title={`Map of ${name}`}
        />
      </div>
      <a href={osmLink} target="_blank" rel="noopener noreferrer" style={{
        display: 'block', padding: '8px 20px', fontSize: 13, color: 'var(--text-muted)',
        textDecoration: 'underline', textUnderlineOffset: 4,
      }}>
        Open in OpenStreetMap ↗
      </a>
    </div>
  )
}

/* ── Race row ──────────────────────────────────────────────────────────────── */

function RaceRow({ race, status, onClick, selected }) {
  const next = status === 'next'
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        style={{
          display: 'grid',
          gridTemplateColumns: '36px minmax(0, 1fr) auto',
          alignItems: 'center', gap: 14,
          width: '100%', padding: '12px 16px',
          textAlign: 'left', color: 'inherit', font: 'inherit',
          background: selected ? 'var(--pill-active)' : 'var(--bg-elevated)',
          border: `1px solid ${selected ? 'var(--border-strong)' : 'var(--border)'}`,
          borderLeft: `3px solid ${next ? 'var(--accent)' : 'var(--border-strong)'}`,
          borderRadius: 8,
        }}
      >
        <span style={{ fontFamily: 'var(--display)', fontSize: 20, lineHeight: 1, color: 'var(--text-muted)', textAlign: 'center' }}>
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Round </span>
          {race.round}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 15, color: status === 'past' ? 'var(--text-muted)' : 'var(--text)' }}>
            {race.raceName}
          </span>
          <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {race.circuitName} · {race.locality}, {race.country}
          </span>
        </span>
        <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'block', fontSize: 14 }}>{weekendRange(race.fp1 || race.date, race.date)}</span>
          {next ? (
            <span style={{
              display: 'inline-block', marginTop: 4, padding: '1px 8px', borderRadius: 999,
              background: 'var(--accent)', color: '#141519', fontSize: 12, fontWeight: 600,
            }}>Next race</span>
          ) : (
            <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--text-muted)' }}>{STATUS_LABEL[status]}</span>
          )}
        </span>
      </button>
    </li>
  )
}

/* ── Race detail panel ─────────────────────────────────────────────────────── */

function RaceDetail({ race, onClose }) {
  const sessions = [
    ['Practice 1', race.fp1],
    ['Practice 2', race.fp2],
    ['Practice 3', race.fp3],
    ['Sprint', race.sprint],
    ['Qualifying', race.qualifying],
    ['Race', `${race.date}${race.time ? ` · ${race.time.slice(0, 5)} UTC` : ''}`],
  ].filter(([, date]) => date)

  return (
    <section className={styles.panel} aria-label={`${race.raceName} details`}>
      {race.lat && race.lng && <MapPanel lat={race.lat} lng={race.lng} name={race.circuitName} />}
      {onClose && <button type="button" className={styles.close} onClick={onClose}>Close</button>}

      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Round {race.round}</p>
      <h2 style={{ fontFamily: 'var(--display)', fontWeight: 400, fontSize: 28, lineHeight: 1.1, letterSpacing: '0.02em' }}>
        {race.raceName}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{race.circuitName}</p>

      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Sessions</h3>
      <dl style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
        {sessions.map(([label, date]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <dt style={{ color: label === 'Race' ? 'var(--text)' : 'var(--text-muted)', fontWeight: label === 'Race' ? 600 : 400 }}>{label}</dt>
            <dd style={{ fontWeight: label === 'Race' ? 600 : 400 }}>{date}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function SchedulePage({ season }) {
  const isMobile = useIsMobile(900)
  const [selected, setSelected] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['schedule', season],
    queryFn: () => f1Api.getSchedule(season),
  })

  if (isLoading) return <Loader label="Fetching race calendar..." />
  if (error)     return <ErrorMsg error={error} />

  const races   = data?.races || []
  const today   = new Date().toISOString().slice(0, 10)
  const nextIdx = races.findIndex(r => r.date >= today)
  // Wide screens always show a race (the next one, or the last of a finished season); phones only on demand.
  const detail = selected ?? (isMobile ? null : races[nextIdx] ?? races[races.length - 1])

  return (
    <div>
      <header className={styles.header}>
        <SectionHeading as="h1" title="Race calendar" badge={`${races.length} rounds · ${season}`} />
      </header>

      <div className={styles.layout}>
        <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {races.map((race, idx) => (
            <RaceRow
              key={race.round}
              race={race}
              status={getStatus(race.date, nextIdx, idx)}
              selected={detail?.round === race.round}
              onClick={() => setSelected(selected?.round === race.round ? null : race)}
            />
          ))}
        </ol>

        {detail && (
          <aside className={styles.aside}>
            <RaceDetail
              key={detail.round}
              race={detail}
              onClose={selected ? () => setSelected(null) : undefined}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
