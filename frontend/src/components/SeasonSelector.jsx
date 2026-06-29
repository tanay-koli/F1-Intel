import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'

export default function SeasonSelector({ season, onChange }) {
  const { data } = useQuery({
    queryKey: ['seasons'],
    queryFn: f1Api.getSeasons,
    staleTime: Infinity
  })

  // fallback list while loading
  const seasons = data?.seasons || ['2025', '2024', '2023', '2022', '2021', '2020']

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>
        SEASON
      </span>
      <select
        value={season}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 6, color: 'var(--text)',
          padding: '4px 10px',
          fontFamily: 'var(--mono)', fontSize: 13,
          cursor: 'pointer', outline: 'none',
          appearance: 'none',
          paddingRight: 24,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b6b7a'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center'
        }}
      >
        {seasons.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  )
}
