import { useSearchParams } from 'react-router-dom'

export const CURRENT_SEASON = String(new Date().getFullYear())

/** Season lives in the URL (`?season=2026`) so every view is linkable. */
export function useSeason() {
  const [params, setParams] = useSearchParams()
  const season = params.get('season') || CURRENT_SEASON

  const setSeason = (next) => {
    setParams(prev => {
      const p = new URLSearchParams(prev)
      if (next === CURRENT_SEASON) p.delete('season')
      else p.set('season', next)
      // A round picked for one season means nothing in another
      p.delete('round')
      return p
    })
  }

  return [season, setSeason]
}

/** Build a link that keeps the current season (omitted when it's the default). */
export function withSeason(path, season, extra = {}) {
  const p = new URLSearchParams(extra)
  if (season !== CURRENT_SEASON) p.set('season', season)
  const qs = p.toString()
  return qs ? `${path}?${qs}` : path
}
