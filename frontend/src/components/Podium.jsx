import styles from './Podium.module.css'

/**
 * Top three as flat cards, P1 in the middle on wide screens and as rows on a
 * phone. Each item: { key, position, color, image, name, subline, figure,
 * unit, detail, onClick, selected }.
 */
export default function Podium({ items, label }) {
  return (
    <ol className={styles.podium} aria-label={label}>
      {items.map(({ key, position, color, image, name, subline, figure, unit, detail, onClick, selected }) => {
        const Inner = onClick ? 'button' : 'div'
        const buttonProps = onClick ? { type: 'button', onClick, 'aria-pressed': !!selected } : {}
        return (
          <li key={key} className={styles.step} data-pos={position} style={{ '--team': color }}>
            <Inner className={styles.card} data-selected={selected || undefined} {...buttonProps}>
              <span className={styles.pos}>P{position}</span>
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
