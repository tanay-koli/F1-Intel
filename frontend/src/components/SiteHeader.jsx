import { NavLink, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { withSeason } from '../hooks/useSeason'
import styles from './SiteHeader.module.css'

const ANALYSIS_LINKS = [
  { to: '/results',   label: 'Results' },
  { to: '/pit-stops', label: 'Pit stops' },
  { to: '/h2h',       label: 'Head-to-head' },
  { to: '/telemetry', label: 'Telemetry' },
]

const pillClass = ({ isActive }) => isActive ? `${styles.pill} ${styles.active}` : styles.pill

export default function SiteHeader({ season, onSeasonChange }) {
  const { data } = useQuery({
    queryKey: ['seasons'],
    queryFn: f1Api.getSeasons,
    staleTime: Infinity,
  })
  const seasons = data?.seasons || [season]
  // Keep the select valid if the URL names a season the list doesn't have yet
  const options = seasons.includes(season) ? seasons : [season, ...seasons]

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to={withSeason('/', season)} className={styles.brand} aria-label="F1 Dashboard home">
          <span className={styles.badge}>F1</span>
          <span className={styles.wordmark}>Dashboard</span>
        </Link>

        <nav className={styles.nav} aria-label="Main">
          <NavLink to={withSeason('/', season)} end className={pillClass}>Home</NavLink>
          <span className={styles.divider} aria-hidden="true" />
          {ANALYSIS_LINKS.map(l => (
            <NavLink key={l.to} to={withSeason(l.to, season)} className={pillClass}>{l.label}</NavLink>
          ))}
        </nav>

        <div className={styles.season}>
          <label htmlFor="season-select" className={styles.seasonLabel}>Season</label>
          <select
            id="season-select"
            className={styles.select}
            value={season}
            onChange={e => onSeasonChange(e.target.value)}
          >
            {options.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </header>
  )
}
