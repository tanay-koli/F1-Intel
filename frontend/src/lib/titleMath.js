// Maximum points one driver can add per weekend type
export const MAX_GP_POINTS = 25
export const MAX_SPRINT_POINTS = 8

const weekendMax = (race) => MAX_GP_POINTS + (race.sprint ? MAX_SPRINT_POINTS : 0)

/**
 * Championship situation between the top two drivers.
 *
 * @param standings  driver standings, sorted by position (from /api/driver-standings)
 * @param remaining  schedule entries not yet raced, in round order (next race first)
 * @returns null if there's no fight to describe, otherwise
 *   { leader, second, gap, racesLeft, clinched, canClinchThisWeekend }
 *
 * "Can clinch" is the best case for the leader: they take the maximum this
 * weekend while P2 scores nothing, and the resulting lead exceeds everything
 * still available afterwards. A tie on points goes to countback, so it
 * doesn't count as sealed.
 */
export function titleContext(standings, remaining) {
  const [leader, second] = standings ?? []
  if (!leader || !second) return null

  const gap = leader.points - second.points
  const maxRemaining = remaining.reduce((sum, r) => sum + weekendMax(r), 0)
  const next = remaining[0]
  const maxAfterNext = next ? maxRemaining - weekendMax(next) : 0

  return {
    leader,
    second,
    gap,
    racesLeft: remaining.length,
    clinched: gap > maxRemaining,
    canClinchThisWeekend: !!next && gap <= maxRemaining && gap + weekendMax(next) > maxAfterNext,
  }
}
