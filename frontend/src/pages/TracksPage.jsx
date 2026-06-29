import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, SectionHeader } from '../components/ui'

function CircuitCard({ circuit, onClick, selected }) {
  return (
    <div
      onClick={() => onClick(circuit)}
      style={{
        background: selected ? 'var(--bg-elevated)' : 'var(--bg-card)',
        border: `1px solid ${selected ? '#e1060060' : 'var(--border)'}`,
        borderRadius: 10, padding: '14px 18px',
        cursor: 'pointer', transition: 'all 0.15s ease',
        display: 'flex', alignItems: 'center', gap: 14,
        animation: 'fadeUp 0.3s ease both',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = '#e1060040' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {/* Flag */}
      <div style={{
        width: 44, height: 44, borderRadius: 8,
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0
      }}>
        {circuit.flag}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {circuit.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {circuit.locality}, {circuit.country}
        </div>
      </div>

      {/* Coordinates */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)' }}>
          {circuit.lat.toFixed(3)}°
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-dim)' }}>
          {circuit.lng.toFixed(3)}°
        </div>
      </div>
    </div>
  )
}

function CircuitProfile({ circuit }) {
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${circuit.lng - 0.05},${circuit.lat - 0.05},${circuit.lng + 0.05},${circuit.lat + 0.05}&layer=mapnik&marker=${circuit.lat},${circuit.lng}`
  const osmLink = `https://www.openstreetmap.org/?mlat=${circuit.lat}&mlon=${circuit.lng}#map=14/${circuit.lat}/${circuit.lng}`

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderTop: '3px solid var(--red)',
      borderRadius: 12, overflow: 'hidden',
      position: 'sticky', top: 80,
      animation: 'fadeUp 0.25s ease'
    }}>
      {/* Map embed */}
      <div style={{ height: 200, background: '#0d1117', position: 'relative' }}>
        <iframe
          src={mapUrl}
          style={{ width: '100%', height: '100%', border: 'none', filter: 'invert(0.9) hue-rotate(180deg) contrast(0.85)' }}
          title={circuit.name}
        />
      </div>

      {/* Info */}
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 24 }}>{circuit.flag}</span>
        </div>
        <div style={{ fontFamily: 'var(--display)', fontSize: 30, lineHeight: 1.1, marginBottom: 6 }}>
          {circuit.name}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {circuit.locality} · {circuit.country}
        </div>

        {/* Coordinate card */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 14px',
          fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 14
        }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>COORDINATES</div>
          <div>LAT {circuit.lat.toFixed(5)}°</div>
          <div>LNG {circuit.lng.toFixed(5)}°</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {circuit.url && (
            <a href={circuit.url} target="_blank" rel="noopener noreferrer"
              style={{
                fontSize: 12, color: 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: 6,
                padding: '6px 12px'
              }}>
              Wikipedia ↗
            </a>
          )}
          <a href={osmLink} target="_blank" rel="noopener noreferrer"
            style={{
              fontSize: 12, color: 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: 6,
              padding: '6px 12px'
            }}>
            Map ↗
          </a>
        </div>
      </div>
    </div>
  )
}

export default function TracksPage({ season }) {
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['circuits', season],
    queryFn: () => f1Api.getCircuits(season)
  })

  if (isLoading) return <Loader label="Fetching circuits..." />
  if (error) return <ErrorMsg message={error.message} />

  const circuits = (data?.circuits || []).filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.country.toLowerCase().includes(search.toLowerCase()) ||
    c.locality.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <SectionHeader title="Circuits" count={`${circuits.length} tracks`} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search circuits..."
          style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 12px', color: 'var(--text)',
            fontFamily: 'var(--body)', fontSize: 13, outline: 'none',
            width: 200
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {circuits.map(c => (
            <CircuitCard
              key={c.circuitId}
              circuit={c}
              selected={selected?.circuitId === c.circuitId}
              onClick={circ => setSelected(selected?.circuitId === circ.circuitId ? null : circ)}
            />
          ))}
        </div>

        {selected && (
          <div>
            <button
              onClick={() => setSelected(null)}
              style={{
                fontSize: 11, color: 'var(--text-muted)', marginBottom: 10,
                fontFamily: 'var(--mono)', padding: '4px 8px',
                border: '1px solid var(--border)', borderRadius: 4
              }}
            >
              ✕ close
            </button>
            <CircuitProfile circuit={selected} />
          </div>
        )}
      </div>
    </div>
  )
}
