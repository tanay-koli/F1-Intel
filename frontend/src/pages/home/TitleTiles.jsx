import { endMs } from './weekend'
import { titleContext, MAX_GP_POINTS, MAX_SPRINT_POINTS } from '../../lib/titleMath'
import { countWord, surname, points } from '../../lib/format'
import styles from './Home.module.css'

function Tile({ value, unit, label, status, children }) {
  return (
    <li className={styles.tile}>
      <div className={styles.tileTop}>
        <p className={styles.tileValue}>{value}{unit && <span className={styles.tileUnit}> {unit}</span>}</p>
        {status && <p className={styles.tileStatus}>{status}</p>}
      </div>
      <p className={styles.tileLabel}>{label}</p>
      {children}
    </li>
  )
}

/** Title math as three stat tiles: the gap, the rounds left, the wins. */
export default function TitleTiles({ race, standings, schedule }) {
  if (!race || !standings.data?.standings?.length || !schedule.data?.races) return null

  // Once this weekend's sprint is over its points are in the standings, not still to play for
  const sprint = race.sessions.find(s => s.key === 'sprint')
  const sprintDone = sprint && Date.now() > endMs(sprint)
  const remaining = schedule.data.races
    .filter(r => r.round >= race.round)
    .map(r => (sprintDone && r.round === race.round ? { ...r, sprint: '' } : r))
  if (!remaining.length) return null

  const ctx = titleContext(standings.data.standings, remaining)
  if (!ctx) return null
  const { leader, second, gap, maxRemaining, clinched, canClinchThisWeekend } = ctx

  const status = clinched ? 'Title decided'
    : canClinchThisWeekend ? `Can seal it in ${race.locality}`
    : null
  const sprints = remaining.filter(r => r.sprint).length
  // Room past the seal line so both the gap and the line stay on the scale
  const scale = Math.max(gap, maxRemaining) * 1.15 || 1
  const maxWins = Math.max(leader.wins, second.wins, 1)

  return (
    <ul className={styles.tiles} aria-label="Title fight">
      <Tile
        value={points(gap)}
        unit={gap === 1 ? 'pt' : 'pts'}
        label={`${surname(leader)} leads ${surname(second)}`}
        status={status}
      >
        {/* Gap against the points still available: past the line, the title is sealed */}
        <div className={styles.gapChart}>
          <span className={`${styles.gapTrack} tick-scale`} style={{ '--ticks': Math.max(1, Math.round(scale / 25)) }}>
            <span className={styles.gapFill} style={{ width: `${(gap / scale) * 100}%` }} />
            <span className={styles.gapLine} style={{ left: `${(maxRemaining / scale) * 100}%` }} />
          </span>
          <span className={styles.gapScale}>
            <span>{surname(second)} −{points(gap)}</span>
            <span className={styles.gapLineLabel} style={{ left: `${(maxRemaining / scale) * 100}%` }}>
              {maxRemaining} left
            </span>
          </span>
        </div>
      </Tile>

      <Tile
        value={remaining.length}
        label={`${remaining.length === 1 ? 'Race' : 'Races'} left${sprints ? `, ${countWord(sprints, 'sprint')}` : ''}`}
      >
        {/* One block per round, as wide as the points it offers; sprint weekends carry an S */}
        <ol className={styles.pips}>
          {remaining.map(r => (
            <li
              key={r.round}
              className={styles.pip}
              data-sprint={r.sprint ? '' : undefined}
              style={{ flexGrow: MAX_GP_POINTS + (r.sprint ? MAX_SPRINT_POINTS : 0) }}
            >
              <span className={styles.pipBar} />
              <span className={styles.pipLabel}>R{r.round}{r.sprint ? ' S' : ''}</span>
              <span className={styles.srOnly}>{r.raceName}{r.sprint ? ', sprint weekend' : ''}</span>
            </li>
          ))}
        </ol>
      </Tile>

      <Tile value={leader.wins} label={`${leader.wins === 1 ? 'Win' : 'Wins'} for ${surname(leader)}`}>
        <div className={styles.winBars}>
          {[leader, second].map((d, i) => (
            <div key={d.driverId} className={styles.winRow} data-second={i === 1 || undefined} style={{ '--team': d.teamColor }}>
              <span className={styles.winName}>{d.code || surname(d)}</span>
              <span className={styles.winTrack}>
                <span className={styles.winFill} style={{ width: `${(d.wins / maxWins) * 100}%` }} />
              </span>
              <span className={styles.winCount}>{d.wins}</span>
            </div>
          ))}
        </div>
      </Tile>
    </ul>
  )
}
