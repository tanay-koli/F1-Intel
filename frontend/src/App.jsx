import { Routes, Route, Navigate } from 'react-router-dom'
import { useSeason } from './hooks/useSeason'
import SiteHeader from './components/SiteHeader'
import HomePage from './pages/HomePage'
import DriversPage from './pages/DriversPage'
import ConstructorsPage from './pages/ConstructorsPage'
import SchedulePage from './pages/SchedulePage'
import ResultsPage from './pages/ResultsPage'
import TelemetryPage from './pages/TelemetryPage'
import PitStopsPage from './pages/PitStopsPage'
import H2HPage from './pages/H2HPage'
import styles from './App.module.css'

export default function App() {
  const [season, setSeason] = useSeason()

  return (
    <div className={styles.shell}>
      <SiteHeader season={season} onSeasonChange={setSeason} />

      <main className={styles.main}>
        <Routes>
          <Route path="/"                       element={<HomePage         season={season} />} />
          <Route path="/results"                element={<ResultsPage      season={season} />} />
          <Route path="/pit-stops"              element={<PitStopsPage     season={season} />} />
          <Route path="/h2h"                    element={<H2HPage          season={season} />} />
          <Route path="/telemetry"              element={<TelemetryPage    season={season} key={season} />} />
          <Route path="/standings/drivers"      element={<DriversPage      season={season} />} />
          <Route path="/standings/constructors" element={<ConstructorsPage season={season} />} />
          <Route path="/calendar"               element={<SchedulePage     season={season} />} />
          <Route path="*"                       element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className={styles.footer}>
        Data: Jolpica F1 · FastF1
      </footer>
    </div>
  )
}
