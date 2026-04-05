'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'
import styles from '@/styles/shares.module.css'
import { timeAgo, timeUntil, expiresSoon } from '@/lib/utils'

interface SharedSnippet {
  id: string
  title: string
  lang: string
  tags: string[]
  created_at: string
  expires_at: string
}

export default function SharesPage() {
  const router = useRouter()
  const [shares, setShares] = useState<SharedSnippet[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { toast, toastVisible, showToast } = useToast()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }

      const { data, error } = await supabase
        .from('shared_snippets')
        .select('id, title, lang, tags, created_at, expires_at')
        .eq('user_id', session.user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (!error && data) setShares(data)
      setLoading(false)
    }
    load()
  }, [])

  async function deleteShare(id: string) {
    setDeletingId(id)
    const { error } = await supabase.from('shared_snippets').delete().eq('id', id)
    if (!error) {
      setShares(prev => prev.filter(s => s.id !== id))
      showToast('Share deleted')
    } else {
      showToast('Failed to delete share')
    }
    setDeletingId(null)
  }

  async function copyLink(id: string) {
    const url = `${window.location.origin}/s/${id}`
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>

      <div className={styles.header}>
        <button className={styles.back} onClick={() => router.push('/')}>‹</button>
        <div>
          <h1 className={styles.title}>My Shares</h1>
          <p className={styles.sub}>
            {loading ? '' : `${shares.length} / 20 active share${shares.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

        {loading ? (
          <div className={styles.empty}>brewing...</div>
        ) : shares.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>☕</div>
            <div>No active shares</div>
            <div className={styles.emptySub}>Share a snippet and it'll appear here</div>
          </div>
        ) : (
          <div className={styles.list}>
            {shares.map(share => {
              const expiringSoon = expiresSoon(share.expires_at)
              return (
                <div key={share.id} className={styles.card}>
                  <div className={styles.cardMain}>
                    <div className={styles.cardTitle}>{share.title}</div>
                    <div className={styles.cardMeta}>
                      <span className={styles.langBadge}>{share.lang}</span>
                      {share.tags.map(tag => (
                        <span key={tag} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                    <div className={styles.cardDates}>
                      <span>Shared {timeAgo(share.created_at)}</span>
                      <span
                        className={`${styles.expiry} ${expiringSoon ? styles.expirySoon : ''}`}
                      >
                        ⏱ {timeUntil(share.expires_at)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      className={styles.btnCopy}
                      onClick={() => copyLink(share.id)}
                    >
                      {copiedId === share.id ? '✓ Copied' : 'Copy link'}
                    </button>
                    <button
                      className={styles.btnDelete}
                      onClick={() => deleteShare(share.id)}
                      disabled={deletingId === share.id}
                    >
                      {deletingId === share.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className={`${styles.toast} ${!toastVisible ? styles.toastOut : ''}`}>
          {toast}
        </div>
      )}
    </div>
  )
}