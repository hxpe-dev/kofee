import Link from 'next/link'
import styles from '@/styles/notFound.module.css'

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.coffeeIcon}>☕</div>
      <div className={styles.title}>
        Page not found
      </div>
      <div className={styles.msg}>
        This brew doesn't exist.
      </div>
      <Link href="/" className={styles.back}>
        Back to Kofee
      </Link>
    </div>
  )
}