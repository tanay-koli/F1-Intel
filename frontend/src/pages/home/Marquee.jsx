import styles from './Home.module.css'

/** Full-bleed band with the next GP's name scrolling past. Decorative: the name is the hero's h1. */
export default function Marquee({ text }) {
  // Two identical halves, so translating by -50% loops seamlessly
  const run = Array.from({ length: 4 }, (_, i) => (
    <span key={i} className={i % 2 ? styles.marqueeOutline : undefined}>{text}</span>
  ))
  return (
    <div className={styles.marquee} aria-hidden="true">
      <div className={styles.marqueeTrack}>{run}{run}</div>
    </div>
  )
}
