import styles from './Skeleton.module.css'

/** Grey placeholder block; give it the size of the content it stands in for. */
export default function Skeleton({ width = '100%', height = 16, radius = 6, className = '' }) {
  return (
    <span
      className={`${styles.block} ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}
