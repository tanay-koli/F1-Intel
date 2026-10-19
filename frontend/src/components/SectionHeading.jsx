import { Link } from 'react-router-dom'
import styles from './SectionHeading.module.css'

/**
 * Display-font heading with the red left bar and an optional outlined badge
 * (matches the "DRIVER STANDINGS · Round 17" header on the standings pages).
 */
export default function SectionHeading({ title, badge, link, id, as: Tag = 'h2' }) {
  return (
    <div className={styles.row}>
      <span className={styles.bar} aria-hidden="true" />
      <Tag id={id} className={styles.title}>{title}</Tag>
      {badge && <span className={styles.badge}>{badge}</span>}
      {link && <Link to={link.to} className={styles.link}>{link.label}</Link>}
    </div>
  )
}
