import styles from './telemetry.module.css'

const NEUTRALISED = ['SC', 'VSC', 'RED']
const EVENT_LABEL = { SC: 'Safety car', VSC: 'Virtual safety car', RED: 'Red flag' }

function Tile({ value, label, children }) {
  return (
    <li className={styles.tile}>
      <p className={styles.tileValue}>{value}</p>
      <p className={styles.tileLabel}>{label}</p>
      <div className={styles.tileChart}>{children}</div>
    </li>
  )
}

/** Race name over four stat tiles: laps and neutralisations, fastest laps, pit stops, movers. */
export default function RaceHeader({ analysis, eventColors }) {
  const { drivers, totalLaps } = analysis
  const fl = analysis.overallFastestLap
  const events = (analysis.raceEvents ?? []).filter(e => NEUTRALISED.includes(e.type) && e.lap)

  const fastest = drivers
    .filter(d => d.fastestLapTime)
    .sort((a, b) => a.fastestLapTime - b.fastestLapTime)
    .slice(0, 3)
  const best = fastest[0]?.fastestLapTime

  const stops = drivers.reduce((n, d) => n + (d.pitStops ?? 0), 0)
  const spread = [0, 1, 2, 3].map(n => ({
    n,
    count: drivers.filter(d => (n === 3 ? d.pitStops >= 3 : d.pitStops === n)).length,
  }))
  const maxCount = Math.max(1, ...spread.map(s => s.count))

  const movers = drivers
    .filter(d => d.positionsGained > 0 && d.finishPosition)
    .sort((a, b) => b.positionsGained - a.positionsGained)
    .slice(0, 3)
  const maxGain = movers[0]?.positionsGained ?? 1

  return (
    <header className={styles.raceHead}>
      <h2 className={styles.raceName}>{analysis.raceName}</h2>
      <p className={styles.raceMeta}>{analysis.year} · Round {analysis.round} · Race</p>

      <ul className={styles.tiles} aria-label="Race in numbers">
        <Tile value={totalLaps} label={events.length ? `Laps, ${events.length} neutralised` : 'Laps, all green'}>
          <div className={styles.lapTrack}>
            {events.map((e, i) => (
              <span
                key={i}
                className={styles.lapMark}
                style={{ left: `${((e.lap - 1) / totalLaps) * 100}%`, background: eventColors[e.type] }}
                title={`${EVENT_LABEL[e.type]}, lap ${e.lap}`}
              />
            ))}
          </div>
          <div className={styles.chartNote}>
            <span>L1</span>
            <span>{events.map(e => `${e.type} L${e.lap}`).join(' · ')}</span>
            <span>L{totalLaps}</span>
          </div>
        </Tile>

        {fl?.driver && (
          <Tile value={fl.timeStr} label={`Fastest lap, ${fl.driver} on lap ${fl.lap}`}>
            <ol className={styles.bars}>
              {fastest.map(d => (
                <li key={d.code} className={styles.barRow} style={{ '--team': d.teamColor }}>
                  <span className={styles.barName}>{d.code}</span>
                  <span className={styles.barTrack}>
                    <span className={styles.barFill} style={{ width: `${(best / d.fastestLapTime) ** 40 * 100}%` }} />
                  </span>
                  <span className={styles.barValue}>
                    {d.fastestLapTime === best ? d.fastestLapTimeStr : `+${(d.fastestLapTime - best).toFixed(3)}`}
                  </span>
                </li>
              ))}
            </ol>
          </Tile>
        )}

        <Tile value={stops} label="Pit stops, all drivers">
          <div className={styles.columns}>
            {spread.map(s => (
              <div key={s.n} className={styles.column}>
                <span className={styles.columnCount}>{s.count}</span>
                <span className={styles.columnBar} style={{ height: `${(s.count / maxCount) * 100}%` }} />
                <span className={styles.columnLabel}>{s.n === 3 ? '3+' : s.n} stop{s.n === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        </Tile>

        {movers.length > 0 && (
          <Tile value={`+${movers[0].positionsGained}`} label={`Most places gained, ${movers[0].code} P${movers[0].gridPosition} to P${movers[0].finishPosition}`}>
            <ol className={styles.bars}>
              {movers.map(d => (
                <li key={d.code} className={styles.barRow} style={{ '--team': d.teamColor }}>
                  <span className={styles.barName}>{d.code}</span>
                  <span className={styles.barTrack}>
                    <span className={styles.barFill} style={{ width: `${(d.positionsGained / maxGain) * 100}%` }} />
                  </span>
                  <span className={styles.barValue}>+{d.positionsGained}</span>
                </li>
              ))}
            </ol>
          </Tile>
        )}
      </ul>
    </header>
  )
}
