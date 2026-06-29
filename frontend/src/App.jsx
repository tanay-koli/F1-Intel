import { useState } from 'react'
import { useIsMobile } from './components/ui'
import SeasonSelector from './components/SeasonSelector'
import DriversPage from './pages/DriversPage'
import ConstructorsPage from './pages/ConstructorsPage'
import SchedulePage from './pages/SchedulePage'
import ResultsPage from './pages/ResultsPage'
import TelemetryPage from './pages/TelemetryPage'

import PitStopsPage from './pages/PitStopsPage'
import H2HPage from './pages/H2HPage'

const TABS = [
  { id: 'drivers',      label: 'Drivers',       icon: '🏎' },
  { id: 'constructors', label: 'Constructors',   icon: '🏭' },
  { id: 'schedule',     label: 'Calendar',       icon: '📅' },
  { id: 'results',      label: 'Results',        icon: '🏁' },
  { id: 'pitstops',     label: 'Pit Stops',      icon: '🔧' },
  { id: 'h2h',          label: 'H2H',            icon: '⚔️' },
  { id: 'telemetry',    label: 'Telemetry',      icon: '📡' },
]

function NavTab({ tab, active, onClick }) {
  return (
    <button
      onClick={() => onClick(tab.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 8,
        background: active ? 'var(--bg-elevated)' : 'transparent',
        border: `1px solid ${active ? 'var(--border)' : 'transparent'}`,
        color: active ? 'var(--text)' : 'var(--text-muted)',
        fontFamily: 'var(--body)', fontWeight: active ? 600 : 400,
        fontSize: 13, transition: 'all 0.15s ease',
        cursor: 'pointer',
        borderBottom: active ? '2px solid var(--red)' : '2px solid transparent',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 14 }}>{tab.icon}</span>
      <span>{tab.label}</span>
    </button>
  )
}

export default function App() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('drivers')
  const [season, setSeason] = useState('2026')

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg)cc',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: 60, gap: 16
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{
              background: 'var(--red)', borderRadius: 6,
              padding: '4px 10px',
              fontFamily: 'var(--display)', fontSize: 18, letterSpacing: '0.1em',
              lineHeight: 1
            }}>
              F1
            </div>
            <div style={{
              fontFamily: 'var(--display)', fontSize: 18,
              letterSpacing: '0.06em', color: 'var(--text-muted)',
              display: window.innerWidth < 600 ? 'none' : 'block'
            }}>
              DASHBOARD
            </div>
          </div>

          {/* Nav tabs — scrollable on small screens */}
          <nav style={{
            display: 'flex', gap: 2, overflowX: 'auto',
            scrollbarWidth: 'none', flex: 1, justifyContent: 'center'
          }}>
            {TABS.map(t => (
              <NavTab key={t.id} tab={t} active={tab === t.id} onClick={setTab} />
            ))}
          </nav>

          {/* Season selector */}
          <div style={{ flexShrink: 0 }}>
            <SeasonSelector season={season} onChange={setSeason} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '20px 12px' : '32px 24px' }}>
        {tab === 'drivers'      && <DriversPage       season={season} />}
        {tab === 'constructors' && <ConstructorsPage   season={season} />}
        {tab === 'schedule'     && <SchedulePage       season={season} />}
        {tab === 'results'      && <ResultsPage        season={season} />}
        {tab === 'pitstops'     && <PitStopsPage       season={season} />}
        {tab === 'h2h'          && <H2HPage            season={season} />}
        {tab === 'telemetry'    && <TelemetryPage      season={season} />}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '16px 24px',
        textAlign: 'center', fontSize: 11,
        color: 'var(--text-dim)', fontFamily: 'var(--mono)'
      }}>
        Data: Ergast F1 API · FastF1 · Built with React + FastAPI
      </footer>
    </div>
  )
}
