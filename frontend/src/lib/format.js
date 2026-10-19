const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

/** "six races", "one race", "12 races" */
export function countWord(n, noun) {
  const word = n <= 10 ? WORDS[n] : String(n)
  return `${word} ${noun}${n === 1 ? '' : 's'}`
}

export function surname(person) {
  return person.familyName || person.fullName?.split(' ').slice(-1)[0] || ''
}

export function points(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** "United States Grand Prix" -> "United States" */
export function shortGpName(raceName) {
  return raceName.replace(/\s+Grand Prix$/i, '')
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayOnly  = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' })

/** Weekend date range from YYYY-MM-DD strings: "23–25 Oct", "30 Oct – 1 Nov" */
export function weekendRange(startDate, endDate) {
  const end = new Date(`${endDate}T00:00:00Z`)
  if (!startDate || startDate === endDate) return dayMonth.format(end)
  const start = new Date(`${startDate}T00:00:00Z`)
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${dayOnly.format(start)}–${dayMonth.format(end)}`
    : `${dayMonth.format(start)} – ${dayMonth.format(end)}`
}
