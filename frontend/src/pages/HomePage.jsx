import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import NextRaceHero from './home/NextRaceHero'
import Marquee from './home/Marquee'
import TitleTiles from './home/TitleTiles'
import LastRacePanel from './home/LastRacePanel'
import { DriversPanel, ConstructorsPanel } from './home/StandingsPanel'
import SeasonStrip from './home/SeasonStrip'
import styles from './home/Home.module.css'

export default function HomePage({ season }) {
  // Same query keys as the other pages, so their caches are shared
  const nextRace     = useQuery({ queryKey: ['next-race', season],             queryFn: () => f1Api.getNextRace(season) })
  const schedule     = useQuery({ queryKey: ['schedule', season],              queryFn: () => f1Api.getSchedule(season) })
  const drivers      = useQuery({ queryKey: ['driver-standings', season],      queryFn: () => f1Api.getDriverStandings(season) })
  const constructors = useQuery({ queryKey: ['constructor-standings', season], queryFn: () => f1Api.getConstructorStandings(season) })
  const results      = useQuery({ queryKey: ['results', season, 'last'],       queryFn: () => f1Api.getRaceResults(season, 'last') })
  const race = nextRace.data?.race

  return (
    <div className={styles.page}>
      <NextRaceHero season={season} nextRace={nextRace} standings={drivers} />
      {race && <Marquee text={`${race.raceName} ${race.season ?? season}`} />}
      <TitleTiles race={race} standings={drivers} schedule={schedule} />

      <div className={styles.panels}>
        <LastRacePanel season={season} results={results} />
        <DriversPanel season={season} drivers={drivers} />
        <ConstructorsPanel season={season} constructors={constructors} drivers={drivers} />
      </div>

      <SeasonStrip season={season} schedule={schedule} nextRound={nextRace.data?.race?.round} />

      <p className={styles.footnote}>Standings and results from Jolpica F1, updated after each session.</p>
    </div>
  )
}
