import styles from './StandingsRow.module.css'

export function StandingsList({ children }) {
  return <ol className={styles.list}>{children}</ol>
}

/**
 * One ranked row: position, picture, name over an optional share bar and a
 * subline, and a figure with a detail line under it. `share` (0–1) draws the
 * bar against the leader. Pass `onClick` to make the row a button; `selected`
 * marks the row whose detail is open.
 */
export default function StandingsRow({
  position, color, image, name, subline, share, figure, unit, detail, onClick, selected,
}) {
  const Inner = onClick ? 'button' : 'div'
  const buttonProps = onClick ? { type: 'button', onClick, 'aria-pressed': !!selected } : {}
  return (
    <li style={{ '--team': color }}>
      <Inner className={styles.row} data-selected={selected || undefined} {...buttonProps}>
        <span className={styles.pos}>
          <span className={styles.srOnly}>Position </span>{position}
        </span>
        {image}
        <span className={styles.main}>
          <span className={styles.name}>{name}</span>
          {share != null && (
            <span className={styles.bar} aria-hidden="true">
              <span className={styles.barFill} style={{ width: `${share * 100}%` }} />
            </span>
          )}
          {subline && <span className={styles.sub}>{subline}</span>}
        </span>
        <span className={styles.figures}>
          <span className={styles.value}>
            {figure}{unit && <span className={styles.unit}> {unit}</span>}
          </span>
          {detail && <span className={styles.detail}>{detail}</span>}
        </span>
      </Inner>
    </li>
  )
}
