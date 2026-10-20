import { Link } from 'react-router-dom'
import { DriverImage, ConstructorImage } from '../../components/F1Image'
import SectionHeading from '../../components/SectionHeading'
import Skeleton from '../../components/Skeleton'
import { withSeason } from '../../hooks/useSeason'
import { surname, points } from '../../lib/format'
import styles from './Home.module.css'

const TOP_N = 6

/** Link under a panel to the season's points-progression chart. */
function ProgressionLink({ season, view }) {
  return (
    <Link to={withSeason('/standings/progression', season, view ? { view } : {})} className={styles.panelFooterLink}>
      Points through the season
    </Link>
  )
}

function Row({ position, color, image, name, subline, pts, leaderPts }) {
  const gap = leaderPts - pts
  return (
    <li className={styles.standRow} style={{ '--team': color }}>
      <span className={styles.standPos}>
        <span className={styles.srOnly}>Position </span>{position}
      </span>
      {image}
      <div className={styles.standMain}>
        <span className={styles.standName}>{name}</span>
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${leaderPts ? (pts / leaderPts) * 100 : 0}%` }} />
        </span>
        <span className={styles.standSub}>{subline}</span>
      </div>
      <div className={styles.standPts}>
        <span className={styles.ptsValue}>
          {points(pts)}<span className={styles.ptsUnit}> pts</span>
        </span>
        <span className={styles.ptsGap}>
          {position === 1 ? 'Leader' : <>−{points(gap)}<span className={styles.srOnly}> points behind the leader</span></>}
        </span>
      </div>
    </li>
  )
}

function RowsSkeleton() {
  return (
    <div className={styles.stack} aria-busy="true" aria-label="Loading standings">
      {Array.from({ length: TOP_N }, (_, i) => <Skeleton key={i} height={64} radius={8} />)}
    </div>
  )
}

export function DriversPanel({ season, drivers }) {
  const rows = drivers.data?.standings?.slice(0, TOP_N) ?? []
  const leaderPts = rows[0]?.points ?? 0

  return (
    <section className={styles.card} aria-labelledby="drivers-heading">
      <SectionHeading
        id="drivers-heading"
        title="Drivers"
        link={{ to: withSeason('/standings/drivers', season), label: 'Full standings' }}
      />
      {drivers.isLoading && <RowsSkeleton />}
      {(drivers.isError || (!drivers.isLoading && !rows.length)) && (
        <p className={styles.panelMessage}>Driver standings aren't available for {season} yet.</p>
      )}
      {rows.length > 0 && (
        <ol className={styles.standList}>
          {rows.map(d => (
            <Row
              key={d.driverId}
              position={d.position}
              color={d.teamColor}
              image={
                <DriverImage
                  key={d.driverId}
                  driverId={d.driverId}
                  size={40}
                  color={d.teamColor}
                  initials={d.code}
                  alt={d.fullName}
                />
              }
              name={surname(d)}
              subline={d.constructorName}
              pts={d.points}
              leaderPts={leaderPts}
            />
          ))}
        </ol>
      )}
      {rows.length > 0 && <ProgressionLink season={season} />}
    </section>
  )
}

export function ConstructorsPanel({ season, constructors, drivers }) {
  const rows = constructors.data?.standings?.slice(0, TOP_N) ?? []
  const leaderPts = rows[0]?.points ?? 0
  const driverNames = (constructorId) =>
    (drivers.data?.standings ?? [])
      .filter(d => d.constructorId === constructorId)
      .map(surname)
      .join(' · ')

  return (
    <section className={styles.card} aria-labelledby="constructors-heading">
      <SectionHeading
        id="constructors-heading"
        title="Constructors"
        link={{ to: withSeason('/standings/constructors', season), label: 'Full standings' }}
      />
      {constructors.isLoading && <RowsSkeleton />}
      {(constructors.isError || (!constructors.isLoading && !rows.length)) && (
        <p className={styles.panelMessage}>Constructor standings aren't available for {season} yet.</p>
      )}
      {rows.length > 0 && (
        <ol className={styles.standList}>
          {rows.map(c => (
            <Row
              key={c.constructorId}
              position={c.position}
              color={c.color}
              image={
                <ConstructorImage
                  key={c.constructorId}
                  constructorId={c.constructorId}
                  width={40}
                  height={40}
                  color={c.color}
                  name={c.name}
                  alt={`${c.name} logo`}
                />
              }
              name={c.name}
              subline={driverNames(c.constructorId)}
              pts={c.points}
              leaderPts={leaderPts}
            />
          ))}
        </ol>
      )}
      {rows.length > 0 && <ProgressionLink season={season} view="constructors" />}
    </section>
  )
}
