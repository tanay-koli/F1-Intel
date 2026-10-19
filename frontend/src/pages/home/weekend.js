// Rough session lengths, used to decide when a session counts as "Done"
const DURATION_MIN = {
  fp1: 60, fp2: 60, fp3: 60,
  sprint_qualifying: 45, sprint: 45,
  qualifying: 60, race: 120,
}

export const startMs = (s) => Date.parse(s.start)
export const endMs   = (s) => startMs(s) + (DURATION_MIN[s.key] ?? 60) * 60_000

/**
 * What the countdown should count to.
 * Before the weekend's first session: the race ("Lights out in").
 * Once it has started: the next session to begin. Null once every session has begun.
 */
export function countdownTarget(sessions, now) {
  if (!sessions.length) return null
  const race = sessions.find(s => s.key === 'race') ?? sessions[sessions.length - 1]
  if (now < startMs(sessions[0])) return { label: 'Lights out in', at: startMs(race) }
  const next = sessions.find(s => startMs(s) > now)
  return next ? { label: `${next.name} starts in`, at: startMs(next) } : null
}
