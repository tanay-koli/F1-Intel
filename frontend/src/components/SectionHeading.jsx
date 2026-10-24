import { Link } from 'react-router-dom'
import styles from './SectionHeading.module.css'

/**
 * Display-font heading with the red bar and an optional outlined badge
 * ("DRIVER STANDINGS · Round 17"). As an h1 it is set at page-title scale.
 */
export default function SectionHeading({ title, badge, link, id, as: Tag = 'h2' }) {
  return (
    <div className={styles.row}>
      <Tag id={id} className={`${styles.title} ${Tag === 'h1' ? styles.page : ''}`}>{title}</Tag>
      {badge && <span className={styles.badge}>{badge}</span>}
      {link && <Link to={link.to} className={styles.link}>{link.label}</Link>}
    </div>
  )
}
