import { NavLink, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { withSeason } from '../hooks/useSeason'
import SeasonPicker from './SeasonPicker'
import styles from './SiteHeader.module.css'

const ANALYSIS_LINKS = [
  { to: '/results',   label: 'Results' },
  { to: '/h2h',       label: 'Head-to-head' },
  { to: '/telemetry', label: 'Telemetry' },
]

/** The pit-board flag from the Pit Wall logo, redrawn as vector so it stays sharp on black. */
function LogoMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 203 206" aria-hidden="true">
      <rect x="32" y="9" width="144" height="87" rx="6" fill="#F5B73B" />
      <rect x="61" y="36" width="83" height="8" fill="var(--bg)" />
      <rect x="79" y="60" width="47" height="8" fill="var(--bg)" />
      <rect x="170" y="0" width="7" height="150" fill="#F5B73B" />
      <rect x="0" y="144" width="203" height="62" fill="#F5B73B" />
    </svg>
  )
}

const pillClass = ({ isActive }) => isActive ? `${styles.pill} ${styles.active}` : styles.pill

export default function SiteHeader({ season, onSeasonChange }) {
  // Telemetry has its own year picker, limited to seasons with timing data
  const onTelemetry = useLocation().pathname.startsWith('/telemetry')
  const { data } = useQuery({
    queryKey: ['seasons'],
    queryFn: f1Api.getSeasons,
    staleTime: Infinity,
  })
  const seasons = data?.seasons || [season]
  // Keep the picker valid if the URL names a season the list doesn't have yet
  const options = seasons.includes(season) ? seasons : [season, ...seasons]

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to={withSeason('/', season)} className={styles.brand} aria-label="Pit Wall home">
          <LogoMark />
          <span className={styles.wordPit}>Pit</span>
          <span className={styles.wordWall}>Wall</span>
        </Link>

        <nav className={styles.nav} aria-label="Main">
          <NavLink to={withSeason('/', season)} end className={pillClass}>Home</NavLink>
          <span className={styles.divider} aria-hidden="true" />
          {ANALYSIS_LINKS.map(l => (
            <NavLink key={l.to} to={withSeason(l.to, season)} className={pillClass}>{l.label}</NavLink>
          ))}
        </nav>

        {!onTelemetry && <div className={styles.season}>
          <span className={styles.seasonLabel} aria-hidden="true">Season</span>
          <SeasonPicker season={season} seasons={options} onChange={onSeasonChange} />
        </div>}
      </div>
    </header>
  )
}
