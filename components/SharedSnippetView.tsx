'use client'

import { useState } from 'react'
import CodeEditor from './CodeEditor'
import { supabase } from '@/lib/supabase'
import { createGuestSnippet, getGuestSnippets, saveGuestSnippets } from '@/lib/guestSnippets'
import styles from '@/styles/sharedSnippetView.module.css'

interface SharedSnippet {
  id: string
  title: string
  code: string
  lang: string
  tags: string[]
  expires_at: string
}

export default function SharedSnippetView({ snippet }: { snippet: SharedSnippet }) {
  const [saved, setSaved] = useState(false)
  const [saveMsg, setSaveMsg] = useState('Save to my Kofee')

  async function saveToAccount() {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      setSaveMsg('Saving to your account...')
      await supabase.from('snippets').insert({
        user_id: user.id,
        title: snippet.title,
        code: snippet.code,
        lang: snippet.lang,
        tags: snippet.tags,
      })
      setSaveMsg('✓ Saved')
    } else {
      setSaveMsg('Saving to your guest account...')
      // Save to guest local storage
      const local = getGuestSnippets()
      const s = createGuestSnippet({
        title: snippet.title,
        code: snippet.code,
        lang: snippet.lang,
        tags: snippet.tags,
      })
      saveGuestSnippets([s, ...local])
      setSaveMsg('✓ Saved')
    }

    setSaved(true)
  }

  const expiresIn = Math.ceil(
    (new Date(snippet.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.topZone}>
          <a href="/" className={styles.logoText}>
            ☕ Kofee
          </a>
          <span style={{ color: 'var(--color-border-2)' }}>·</span>
          <span className={styles.title}>
            {snippet.title}
          </span>
        </div>

        <div className={styles.topZone}>
          <span className={styles.expiration}>
            expires in {expiresIn}d
          </span>
          {snippet.tags.map(tag => (
            <span key={tag} className={styles.tags}>
              {tag}
            </span>
          ))}
          <button
            onClick={saveToAccount}
            disabled={saved}
            className={styles.save}
            style={{
              background: saved ? 'var(--color-surface)' : 'rgba(200,150,90,0.15)',
              border: `1px solid ${saved ? 'var(--color-border-2)' : 'rgba(200,150,90,0.3)'}`,
              color: saved ? 'var(--color-text-faint)' : 'var(--color-accent)',
              cursor: saved ? 'default' : 'pointer',
            }}
            key={saveMsg}
          >
            {saveMsg}
          </button>
        </div>
      </div>

      {/* Read-only editor */}
      <CodeEditor
        value={snippet.code}
        lang={snippet.lang}
        onChange={() => {}}
      />
    </div>
  )
}