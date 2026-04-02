'use client'

import styles from '@/styles/importModal.module.css'

interface Props {
  count: number
  onMigrate: () => void
  onDiscard: () => void
}

export default function MigrateModal({ count, onMigrate, onDiscard }: Props) {
  return (
    <div className={styles.overlay} onClick={onDiscard}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>Migrate local snippets</div>
        <div className={styles.subtitle}>
          You have {count} local snippet{count > 1 ? 's' : ''} saved as a guest.
          Would you like to import them into your account?
        </div>
        <div className={styles.buttonRow}>
          <button className={styles.btnCancel} onClick={onDiscard}>
            Discard
          </button>
          <button className={styles.btnImport} onClick={onMigrate}>
            Import to my account
          </button>
        </div>
      </div>
    </div>
  )
}