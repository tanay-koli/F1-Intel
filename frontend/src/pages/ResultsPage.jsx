import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { f1Api } from '../api'
import { Loader, ErrorMsg } from '../components/ui'
import SectionHeading from '../components/SectionHeading'
import Podium from '../components/Podium'
import StandingsRow, { StandingsList } from '../components/StandingsRow'
import { points, surname } from '../lib/format'
import styles from './ranked.module.css'

/* ── Round Selector ────────────────────────────────────────────────────────── */

function RoundSelector({ schedule, selectedRound, onChange }) {
  if (!schedule?.races?.length) return null
  const today     = new Date().toISOString().slice(0, 10)
  const completed = schedule.races.filter(r => r.date <= today)

  return (
    <label className="field field-inline">
      Round
      <select className="select" value={selectedRound} onChange={e => onChange(e.target.value)}>
        <option value="last">Latest</option>
        {completed.map(r => (
          <option key={r.round} value={r.round}>R{r.round} – {r.raceName}</option>
        ))}
      </select>
    </label>
  )
}

/* ── Rows and summary ──────────────────────────────────────────────────────── */

const isClassified = r => /^\d+$/.test(r.positionText ?? String(r.position))
const bestSession  = r => ['q3', 'q2', 'q1'].find(q => r[q] && r[q] !== '—')

/**
 * A finisher's gap. Jolpica gives lapped cars a time too (not a gap to the
 * winner), so those read "+N laps" instead.
 */
function raceGap(r, leaderLaps) {
  const lapped = r.status === 'Lapped' || /^\+\d+ Laps?$/.test(r.status ?? '')
  const down = Number(leaderLaps) - Number(r.laps)
  if (lapped && down > 0) return `+${down} ${down === 1 ? 'lap' : 'laps'}`
  return r.time || r.status
}

/** Props shared by the podium cards and the rows. */
function resultProps(r, isQual, leaderLaps) {
  const team = r.constructorName
  if (isQual) {
    const best    = bestSession(r)
    const earlier = ['q1', 'q2']
      .filter(q => q !== best && r[q] && r[q] !== '—')
      .map(q => `${q.toUpperCase()} ${r[q]}`)
    return {
      subline: [team, ...earlier].join(' · '),
      figure:  best ? r[best] : '—',
      detail:  best ? `Best in ${best.toUpperCase()}` : 'No time',
    }
  }
  const detail = [
    r.points > 0 && `+${points(r.points)} pts`,
    r.fastestLapRank === 1 && 'Fastest lap',
  ].filter(Boolean).join(' · ')
  return {
    position: isClassified(r) ? r.position : r.positionText,
    subline:  `${team} · ${r.grid > 0 ? `started P${r.grid}` : 'pit lane start'}`,
    figure:   raceGap(r, leaderLaps),
    detail:   detail || '—',
  }
}

function Fact({ label, value, sub }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{value}</dd>
      {sub && <dd className={styles.factSub}>{sub}</dd>}
    </div>
  )
}

function Summary({ results, isQual, isSprint }) {
  const at = pos => results.find(r => r.position === pos)
  const first = at(1)
  const facts = []

  if (isQual) {
    const second = at(2)
    if (first)  facts.push(['Pole', surname(first), `${first[bestSession(first)] ?? '—'} · ${first.constructorName}`])
    if (second) facts.push(['Alongside on the front row', surname(second), `${second[bestSession(second)] ?? '—'} · ${second.constructorName}`])
    const inQ3 = results.filter(r => r.q3 && r.q3 !== '—').length
    facts.push(['Set a time in Q3', `${inQ3} of ${results.length}`])
  } else {
    if (first) facts.push(['Winner', surname(first), `${first.time || first.status} · ${first.constructorName}`])
    const fastest = results.find(r => r.fastestLapRank === 1)
    if (fastest) facts.push(['Fastest lap', surname(fastest), fastest.fastestLapTime])
    const gainer = results
      .filter(r => isClassified(r) && r.grid > 0)
      .reduce((best, r) => (!best || r.grid - r.position > best.grid - best.position ? r : best), null)
    if (gainer && gainer.grid > gainer.position) {
      facts.push(['Most places gained', surname(gainer), `+${gainer.grid - gainer.position}, from P${gainer.grid} to P${gainer.position}`])
    }
    const classified = results.filter(isClassified).length
    facts.push(['Classified', `${classified} of ${results.length}`, `${results.length - classified} not classified`])
  }

  return (
    <section className={`${styles.panel} ${styles.panelBody}`} aria-labelledby="summary-heading">
      <h2 id="summary-heading" className={styles.panelTitle}>
        {isQual ? 'Qualifying summary' : isSprint ? 'Sprint summary' : 'Race summary'}
      </h2>
      <dl className={styles.facts}>
        {facts.map(([label, value, sub]) => <Fact key={label} label={label} value={value} sub={sub} />)}
      </dl>
    </section>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function ResultsPage({ season }) {
  const [activeTab,     setActiveTab]     = useState('race')
  const [searchParams] = useSearchParams()
  const [selectedRound, setSelectedRound] = useState(searchParams.get('round') || 'last')

  const { data: schedule } = useQuery({
    queryKey: ['schedule', season],
    queryFn:  () => f1Api.getSchedule(season),
  })

  const { data: raceData,   isLoading: raceLoading,   error: raceError   } = useQuery({
    queryKey: ['results',   season, selectedRound],
    queryFn:  () => f1Api.getRaceResults(season, selectedRound),
    enabled:  activeTab === 'race',
  })

  const { data: qualData,   isLoading: qualLoading,   error: qualError   } = useQuery({
    queryKey: ['qualifying', season, selectedRound],
    queryFn:  () => f1Api.getQualifying(season, selectedRound),
    enabled:  activeTab === 'qualifying',
  })

  const { data: sprintData, isLoading: sprintLoading, error: sprintError } = useQuery({
    queryKey: ['sprint', season, selectedRound],
    queryFn:  () => f1Api.getSprintResults(season, selectedRound),
    enabled:  activeTab === 'sprint',
  })

  const isSprint  = activeTab === 'sprint'
  const isQual    = activeTab === 'qualifying'
  const isLoading = isSprint ? sprintLoading : isQual ? qualLoading : raceLoading
  const error     = isSprint ? sprintError   : isQual ? qualError   : raceError
  const meta      = isSprint ? sprintData    : isQual ? qualData    : raceData
  const results   = isSprint ? (sprintData?.results || []) : isQual ? (qualData?.results || []) : (raceData?.results || [])

  const podium = results.filter(r => r.position <= 3).sort((a, b) => a.position - b.position)
  const rest   = results.filter(r => r.position > 3)
  const leaderLaps = results.find(r => r.position === 1)?.laps

  const SUB_TABS = [
    { id: 'race',       label: 'Race' },
    { id: 'sprint',     label: 'Sprint' },
    { id: 'qualifying', label: 'Qualifying' },
  ]


  return (
    <div>
      <header className={styles.header}>
        <div>
          <SectionHeading
            as="h1"
            title={isSprint ? 'Sprint results' : isQual ? 'Qualifying' : 'Race results'}
            badge={meta?.round ? `Round ${meta.round}` : undefined}
          />
          {meta?.raceName && <p className={styles.sub}>{meta.raceName} · {meta.date}</p>}
        </div>
        <RoundSelector schedule={schedule} selectedRound={selectedRound} onChange={setSelectedRound} />
      </header>

      <div className={styles.tabs}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={styles.tab}
            aria-pressed={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <Loader label={`Loading ${activeTab} data...`} />}
      {error     && <ErrorMsg error={error} />}

      {!isLoading && !error && results.length === 0 && (
        <p className={styles.message}>
          {isSprint
            ? 'No sprint results for this round. It may not be a sprint weekend.'
            : `No ${activeTab} results available for this round.`}
        </p>
      )}

      {!isLoading && !error && results.length > 0 && (
        <div className={styles.layout}>
          <div>
            {podium.length > 0 && (
              <Podium
                label="Top three"
                items={podium.map(r => ({
                  key: r.driverId,
                  position: r.position,
                  color: r.teamColor,
                  name: surname(r),
                  ...resultProps(r, isQual, leaderLaps),
                }))}
              />
            )}
            <div className={styles.table}>
            <StandingsList>
              {rest.map(r => (
                <StandingsRow
                  key={r.driverId}
                  position={r.position}
                  color={r.teamColor}
                  name={r.fullName}
                  {...resultProps(r, isQual, leaderLaps)}
                />
              ))}
            </StandingsList>
            </div>
          </div>
          <aside className={styles.aside}>
            <Summary results={results} isQual={isQual} isSprint={isSprint} />
          </aside>
        </div>
      )}
    </div>
  )
}
