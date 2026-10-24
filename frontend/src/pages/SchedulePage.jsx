import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, useIsMobile } from '../components/ui'
import SectionHeading from '../components/SectionHeading'
import { weekendRange } from '../lib/format'
import { ExternalLink } from 'lucide-react'
import styles from './ranked.module.css'
import cal from './calendar.module.css'

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
    <div>
      <div className={cal.map}>
        <iframe src={mapUrl} className={cal.mapFrame} title={`Map of ${name}`} />
      </div>
      <a href={osmLink} target="_blank" rel="noopener noreferrer" className={`${styles.extLink} ${cal.mapLink}`}>
        Open in OpenStreetMap <ExternalLink size={14} aria-hidden="true" />
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
        className={cal.row}
        data-status={status}
      >
        <span className={cal.round}>
          <span className={cal.srOnly}>Round </span>
          {race.round}
        </span>
        <span className={cal.main}>
          <span className={cal.name}>{race.raceName}</span>
          <span className={cal.place}>{race.circuitName} · {race.locality}, {race.country}</span>
        </span>
        <span className={cal.when}>
          <span className={cal.dates}>{weekendRange(race.fp1 || race.date, race.date)}</span>
          {next
            ? <span className={cal.badgeNext}>Next race</span>
            : <span className={cal.status}>{STATUS_LABEL[status]}</span>}
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
      <div className={styles.panelBody}>
        <div className={cal.detailHead}>
          <div>
            <h2 className={styles.panelName}>{race.raceName}</h2>
            <p className={cal.detailMeta}>Round {race.round} · {race.circuitName}</p>
          </div>
          {onClose && <button type="button" className={cal.close} onClick={onClose}>Close</button>}
        </div>

        <h3 className={cal.sessionsTitle}>Sessions</h3>
        <dl className={cal.sessions}>
          {sessions.map(([label, date]) => (
            <div key={label} className={cal.session} data-race={label === 'Race' || undefined}>
              <dt>{label}</dt>
              <dd>{date}</dd>
            </div>
          ))}
        </dl>
      </div>
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
        <ol className={`${styles.table} ${cal.list}`}>
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
