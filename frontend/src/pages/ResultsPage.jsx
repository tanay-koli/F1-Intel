import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import { Loader, ErrorMsg, TeamDot, useIsMobile } from '../components/ui'

/* ── helpers ───────────────────────────────────────────────────────────────── */

const MEDAL       = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' }
const MEDAL_LABEL = { 1: '1ST', 2: '2ND', 3: '3RD' }

function hex2rgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* ── Round Selector ────────────────────────────────────────────────────────── */

function RoundSelector({ schedule, selectedRound, onChange }) {
  if (!schedule?.races?.length) return null
  const today     = new Date().toISOString().slice(0, 10)
  const completed = schedule.races.filter(r => r.date <= today)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>ROUND</span>
      <select
        value={selectedRound}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 6, color: 'var(--text)', padding: '4px 28px 4px 10px',
          fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer',
          outline: 'none', appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b6b7a'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
        }}
      >
        <option value="last">Latest</option>
        {completed.map(r => (
          <option key={r.round} value={r.round}>R{r.round} – {r.raceName}</option>
        ))}
      </select>
    </div>
  )
}

/* ── Podium card ───────────────────────────────────────────────────────────── */

function PodiumCard({ result, rank, isQual }) {
  const isFirst = rank === 1
  const color   = result.teamColor || '#e10600'
  const medal   = MEDAL[rank]

  return (
    <div style={{
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      border: `1px solid ${color}40`,
      boxShadow: `0 4px 24px ${color}20`,
      transform: isFirst ? 'translateY(-16px)' : 'translateY(0)',
      transition: 'transform 0.22s ease',
      animation: `fadeUp 0.4s ease ${rank * 80}ms both`,
      background: `linear-gradient(160deg, ${hex2rgba(color, 0.18)} 0%, #111114 55%)`,
      minHeight: isFirst ? 260 : 220,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    }}>
      {/* Diagonal accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '60%', height: '100%',
        background: `linear-gradient(135deg, transparent 30%, ${hex2rgba(color, 0.10)} 100%)`,
        pointerEvents: 'none',
      }} />

      {/* Giant position watermark */}
      <div style={{
        position: 'absolute', top: -8, left: 8,
        fontFamily: 'var(--display)', fontSize: isFirst ? 140 : 120,
        lineHeight: 1, color: hex2rgba(color, 0.18),
        letterSpacing: '-0.02em', userSelect: 'none', pointerEvents: 'none',
      }}>
        {rank}
      </div>

      {/* Medal ribbon */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: medal, borderRadius: 6,
        padding: '3px 10px',
        fontFamily: 'var(--display)', fontSize: 11, letterSpacing: '0.08em', color: '#000',
      }}>
        {MEDAL_LABEL[rank]}
      </div>

      {/* Points or time badge */}
      <div style={{
        position: 'absolute', bottom: 52, right: 12,
        background: hex2rgba(color, 0.25),
        border: `1px solid ${color}60`,
        borderRadius: 8, padding: '4px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {isQual ? (
          <>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.3, color: '#fff' }}>
              {result.q3 !== '—' ? result.q3 : result.q2 !== '—' ? result.q2 : result.q1}
            </span>
            <span style={{ fontSize: 9, color: hex2rgba('#ffffff', 0.6), letterSpacing: '0.1em' }}>
              {result.q3 !== '—' ? 'Q3' : result.q2 !== '—' ? 'Q2' : 'Q1'}
            </span>
          </>
        ) : (
          <>
            <span style={{ fontFamily: 'var(--display)', fontSize: 22, lineHeight: 1, color: '#fff' }}>
              {result.points}
            </span>
            <span style={{ fontSize: 9, color: hex2rgba('#ffffff', 0.6), letterSpacing: '0.1em' }}>PTS</span>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 14px 14px',
        background: `linear-gradient(transparent, ${hex2rgba(color, 0.30)} 100%)`,
        borderTop: `1px solid ${color}30`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 14 }}>{result.flag}</span>
          <span style={{ fontFamily: 'var(--display)', fontSize: isFirst ? 20 : 17, letterSpacing: '0.06em', color: '#fff' }}>
            {result.fullName?.split(' ').pop().toUpperCase()}
          </span>
          {result.fastestLapRank === 1 && !isQual && (
            <span style={{ fontSize: 10, background: '#a855f720', color: '#a855f7', border: '1px solid #a855f740', borderRadius: 4, padding: '1px 5px' }}>⚡FL</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TeamDot color={color} size={7} />
          <span style={{ fontSize: 11, color: hex2rgba('#ffffff', 0.55) }}>{result.constructorName}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Result row (P4+) ──────────────────────────────────────────────────────── */

function ResultRow({ result, isQual }) {
  const color = result.teamColor || '#e10600'
  const dnf   = !isQual && !['1','2','3','4','5','6','7','8','9','10',
                              '11','12','13','14','15','16','17','18','19','20'].includes(result.positionText)
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isQual
        ? '40px 16px 1fr 90px 90px 90px'
        : '40px 16px 1fr auto 80px 80px',
      alignItems: 'center', gap: 12,
      padding: '10px 16px',
      borderRadius: 10,
      background: 'var(--bg-card)',
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${color}`,
      opacity: dnf ? 0.55 : 1,
      animation: `fadeUp 0.3s ease ${(result.position || 4) * 20}ms both`,
    }}>
      {/* Position */}
      <span style={{
        fontFamily: 'var(--display)', fontSize: 20,
        color: dnf ? 'var(--text-dim)' : 'var(--text-muted)',
        textAlign: 'center', lineHeight: 1,
      }}>
        {dnf ? result.positionText : result.position}
      </span>

      {/* Flag */}
      <span style={{ fontSize: 13 }}>{result.flag}</span>

      {/* Driver + team */}
      <div>
        <div style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: '0.04em' }}>
          {result.fullName?.toUpperCase()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <TeamDot color={color} size={5} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{result.constructorName}</span>
        </div>
      </div>

      {/* Q times or grid→pos */}
      {isQual ? (
        ['q1', 'q2', 'q3'].map(q => (
          <div key={q} style={{
            fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'center',
            color: result[q] === '—' ? 'var(--text-dim)' : 'var(--text)',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>{q.toUpperCase()}</div>
            {result[q]}
          </div>
        ))
      ) : (
        <>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            {result.grid}→{result.positionText}
          </span>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: 'var(--display)', fontSize: 18,
              color: result.points > 0 ? 'var(--text)' : 'var(--text-dim)',
            }}>
              {result.points > 0 ? `+${result.points}` : '—'}
            </div>
            {result.points > 0 && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>PTS</div>}
          </div>
          <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>
            {result.fastestLapRank === 1
              ? <span style={{ color: '#a855f7' }}>⚡ {result.fastestLapTime}</span>
              : result.time || result.status}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function ResultsPage({ season }) {
  const isMobile       = useIsMobile()
  const [activeTab,     setActiveTab]     = useState('race')
  const [selectedRound, setSelectedRound] = useState('last')

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
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean)

  const SUB_TABS = [
    { id: 'race',       label: '🏁 Race' },
    { id: 'sprint',     label: '🚀 Sprint' },
    { id: 'qualifying', label: '⏱ Qualifying' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between', marginBottom: 24,
        flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 28, background: 'var(--red)', borderRadius: 2 }} />
            <h2 style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 24 : 32, letterSpacing: '0.06em' }}>
              {isSprint ? 'SPRINT RESULTS' : isQual ? 'QUALIFYING' : 'RACE RESULTS'}
            </h2>
          </div>
          {meta && (
            <div style={{ paddingLeft: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{meta.flag}</span>
              <span style={{ fontFamily: 'var(--display)', fontSize: 15, letterSpacing: '0.04em' }}>
                {meta.raceName}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                · Round {meta.round} · {meta.date}
              </span>
            </div>
          )}
        </div>
        <RoundSelector schedule={schedule} selectedRound={selectedRound} onChange={setSelectedRound} />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '6px 16px', borderRadius: 7, whiteSpace: 'nowrap',
              background: activeTab === t.id ? 'var(--bg-elevated)' : 'transparent',
              border: `1px solid ${activeTab === t.id ? 'var(--border)' : 'transparent'}`,
              color: activeTab === t.id ? 'var(--text)' : 'var(--text-muted)',
              fontSize: 13, fontFamily: 'var(--body)',
              borderBottom: activeTab === t.id ? '2px solid var(--red)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && <Loader label={`Loading ${activeTab} data...`} />}
      {error     && <ErrorMsg message={error.message} />}

      {!isLoading && !error && results.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12, padding: 20 }}>
          {isSprint
            ? 'No sprint results for this round — may not be a sprint weekend.'
            : `No ${activeTab} results available for this round.`}
        </div>
      )}

      {!isLoading && !error && results.length > 0 && (
        <>
          {/* Podium */}
          {podium.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 12, marginBottom: 20,
              alignItems: isMobile ? 'stretch' : 'flex-end',
            }}>
              {(isMobile ? podium : podiumOrder).map(r => (
                <PodiumCard key={r.driverId} result={r} rank={r.position} isQual={isQual} />
              ))}
            </div>
          )}

          {/* Divider */}
          {rest.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 14px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
                {isQual ? 'REMAINING QUALIFIERS' : 'POINTS FINISHERS & DNF'}
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          )}

          {/* P4+ rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {rest.map(r => (
              <ResultRow key={r.driverId} result={r} isQual={isQual} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
