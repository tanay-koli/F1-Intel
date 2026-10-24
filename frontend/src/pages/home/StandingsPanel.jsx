import { Link } from 'react-router-dom'
import { ConstructorImage } from '../../components/F1Image'
import DriverMark from '../../components/DriverMark'
import SectionHeading from '../../components/SectionHeading'
import Skeleton from '../../components/Skeleton'
import StandingsRow, { StandingsList } from '../../components/StandingsRow'
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

/** Gap to the leader, as the detail line under a row's points. */
function GapToLeader({ position, pts, leaderPts }) {
  if (position === 1) return 'Leader'
  return <>−{points(leaderPts - pts)}<span className={styles.srOnly}> points behind the leader</span></>
}

function Row({ position, pts, leaderPts, ...rest }) {
  return (
    <StandingsRow
      {...rest}
      position={position}
      share={leaderPts ? pts / leaderPts : 0}
      figure={points(pts)}
      unit="pts"
      detail={<GapToLeader position={position} pts={pts} leaderPts={leaderPts} />}
    />
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
        <StandingsList>
          {rows.map(d => (
            <Row
              key={d.driverId}
              position={d.position}
              color={d.teamColor}
              image={
<DriverMark driver={d} />
              }
              name={surname(d)}
              subline={d.constructorName}
              pts={d.points}
              leaderPts={leaderPts}
            />
          ))}
        </StandingsList>
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
        <StandingsList>
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
        </StandingsList>
      )}
      {rows.length > 0 && <ProgressionLink season={season} view="constructors" />}
    </section>
  )
}
