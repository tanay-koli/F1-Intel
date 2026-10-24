import { inkOn } from '../lib/color'
import styles from './Podium.module.css'

/**
 * Top three as full-width bands in each team's colour, in finishing order,
 * with the position set huge. Each item: { key, position, color, image, name, subline, figure,
 * unit, detail, onClick, selected }.
 */
export default function Podium({ items, label }) {
  return (
    <ol className={styles.podium} aria-label={label}>
      {items.map(({ key, position, color, image, name, subline, figure, unit, detail, onClick, selected }) => {
        const Inner = onClick ? 'button' : 'div'
        const buttonProps = onClick ? { type: 'button', onClick, 'aria-pressed': !!selected } : {}
        return (
          <li key={key} className={styles.step} data-pos={position} style={{ '--team': color, '--ink': inkOn(color) }}>
            <Inner className={styles.card} data-selected={selected || undefined} {...buttonProps}>
              <span className={styles.pos}><span className={styles.srOnly}>Position </span>{position}</span>
              <span className={styles.image}>{image}</span>
              <span className={styles.who}>
                <span className={styles.name}>{name}</span>
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
      })}
    </ol>
  )
}
