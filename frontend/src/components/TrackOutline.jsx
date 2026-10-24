import { useQuery } from '@tanstack/react-query'
import { f1Api } from '../api'
import styles from './TrackOutline.module.css'

const BOX = 100
const PAD = 6

/** Scale raw FastF1 X/Y points into the viewBox, keeping the aspect ratio. */
function normalize(points) {
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const scale = (BOX - PAD * 2) / Math.max(maxX - minX, maxY - minY || 1)
  const offX = (BOX - (maxX - minX) * scale) / 2
  const offY = (BOX - (maxY - minY) * scale) / 2
  // SVG y grows downward; FastF1 y grows upward
  return points.map(([x, y]) => [offX + (x - minX) * scale, BOX - (offY + (y - minY) * scale)])
}

/** Circuit outline from the warehouse export; renders `fallback` if none exists. */
export default function TrackOutline({ circuitId, locality, label, fallback = null }) {
  const { data } = useQuery({
    queryKey: ['circuit-outline', circuitId],
    queryFn: () => f1Api.getCircuitOutline(circuitId, locality),
    enabled: !!circuitId,
    retry: false,
    staleTime: Infinity,
  })
  if (!data?.points?.length) return fallback

  const pts = normalize(data.points)
  const [sx, sy] = pts[0]

  return (
    <svg className={styles.svg} viewBox={`0 0 ${BOX} ${BOX}`} role="img" aria-label={label}>
      <polyline
        points={pts.map(p => p.join(',')).join(' ')}
        className={styles.track}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={sx} cy={sy} r={2.6} className={styles.start} />
    </svg>
  )
}
