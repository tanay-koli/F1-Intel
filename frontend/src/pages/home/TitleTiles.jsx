import { endMs } from './weekend'
import { titleContext } from '../../lib/titleMath'
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
  const maxWins = Math.max(leader.wins, second.wins, 1)

  return (
    <ul className={styles.tiles} aria-label="Title fight">
      <Tile
        value={points(gap)}
        unit={gap === 1 ? 'pt' : 'pts'}
        label={`${surname(leader)} leads ${surname(second)}`}
        status={status}
      >
        <div className={styles.gapChart}>
          <span className={styles.gapTrack}>
            <span className={styles.gapFill} style={{ width: `${Math.min(1, gap / (maxRemaining || 1)) * 100}%` }} />
          </span>
          <span className={styles.chartNote}>
            <span>Gap</span>
            <span>{maxRemaining} pts still available</span>
          </span>
        </div>
      </Tile>

      <Tile
        value={remaining.length}
        label={`${remaining.length === 1 ? 'Race' : 'Races'} left${sprints ? `, ${countWord(sprints, 'sprint')}` : ''}`}
      >
        <ol className={styles.pips}>
          {remaining.map(r => (
            <li key={r.round} className={styles.pip} data-sprint={r.sprint ? '' : undefined}>
              <span className={styles.pipBar} />
              <span className={styles.pipLabel}>R{r.round}</span>
              <span className={styles.srOnly}>{r.raceName}{r.sprint ? ', sprint weekend' : ''}</span>
            </li>
          ))}
        </ol>
      </Tile>

      <Tile value={leader.wins} label={`${leader.wins === 1 ? 'Win' : 'Wins'} for ${surname(leader)}`}>
        <div className={styles.winBars}>
          {[leader, second].map(d => (
            <div key={d.driverId} className={styles.winRow} style={{ '--team': d.teamColor }}>
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
