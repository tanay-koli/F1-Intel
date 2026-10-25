import { useEffect, useId, useRef, useState } from 'react'
import styles from './SeasonPicker.module.css'

const decadeOf = (year) => `${String(year).slice(0, 3)}0`

/**
 * Season control for the header: a pill that opens a panel with a search box,
 * one chip per decade and that decade's years as a grid. Typing filters across
 * every decade; Enter picks the first match.
 */
export default function SeasonPicker({ season, seasons, onChange }) {
  const [open, setOpen] = useState(false)
  const [decade, setDecade] = useState(decadeOf(season))
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const searchRef = useRef(null)
  const panelId = useId()

  const decades = [...new Set(seasons.map(decadeOf))]
  const q = query.trim()
  // "19" finds the 1900s, "98" finds 1998: a prefix, or the last two digits
  const matches = (s) => s.startsWith(q) || (q.length === 2 && s.endsWith(q))
  const shown = q ? seasons.filter(matches) : seasons.filter(s => decadeOf(s) === decade)

  const close = (refocus = true) => {
    setOpen(false)
    setQuery('')
    if (refocus) triggerRef.current?.focus()
  }

  const pick = (s) => {
    onChange(s)
    close()
  }

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onPointer = (e) => { if (!rootRef.current?.contains(e.target)) close(false) }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (open) return close()
    setDecade(decadeOf(season))
    setOpen(true)
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
      >
        <span className={styles.srOnly}>Season </span>{season}
      </button>

      {open && (
        <div id={panelId} className={styles.panel} role="dialog" aria-label="Choose a season">
          <input
            ref={searchRef}
            type="search"
            inputMode="numeric"
            className={styles.search}
            placeholder="Search a year, e.g. 1988 or 88"
            aria-label="Search seasons"
            value={query}
            onChange={e => setQuery(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={e => { if (e.key === 'Enter' && shown[0]) pick(shown[0]) }}
          />

          {!q && (
            <div className={styles.decades} role="group" aria-label="Decade">
              {decades.map(d => (
                <button
                  key={d}
                  type="button"
                  className={styles.decade}
                  aria-pressed={d === decade}
                  onClick={() => setDecade(d)}
                >
                  {d}s
                </button>
              ))}
            </div>
          )}

          {shown.length > 0 ? (
            <div className={styles.years} role="group" aria-label={q ? 'Matching seasons' : `${decade}s seasons`}>
              {[...shown].sort().map(s => (
                <button
                  key={s}
                  type="button"
                  className={styles.year}
                  aria-pressed={s === season}
                  onClick={() => pick(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No season matches {q}. Seasons run {seasons.at(-1)}–{seasons[0]}.</p>
          )}
        </div>
      )}
    </div>
  )
}
