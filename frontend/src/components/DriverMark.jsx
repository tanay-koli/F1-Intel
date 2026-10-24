import { inkOn } from '../lib/color'
import styles from './DriverMark.module.css'

/**
 * The driver's 3-letter code on their team colour, in place of a photo.
 * Decorative next to a visible name; pass `alt` when it stands alone.
 */
export default function DriverMark({ driver, color, size = 40, alt }) {
  const code = driver.code || (driver.familyName || driver.fullName?.split(' ').at(-1) || '?').slice(0, 3).toUpperCase()
  const team = color || driver.teamColor || '#3A3A3E'
  return (
    <span
      className={styles.mark}
      style={{ '--team': team, '--ink': inkOn(team), '--size': `${size}px` }}
      {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
    >
      {code}
    </span>
  )
}
