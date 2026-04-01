'use client'

import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Snippet } from '@/types/snippet'
import ImportModal from './ImportModal'
import styles from '@/styles/sidebar.module.css'
import { IconDoubleArrows, IconDownload, IconSignOut } from './icons'
import { getGuestSnippets } from '@/lib/guestSnippets'

interface Props {
  snippets: Snippet[]
  currentId: string | null
  isGuest: boolean,
  onSelect: (id: string) => void
  onNew: () => void
  onImported: (snippet: {
    title: string
    code: string
    lang: string
    gist_url: string
  }) => void
  search: string
  onSearch: (v: string) => void
  activeTag: string | null
  onTagClick: (tag: string) => void
  onLogoClick: () => void
  onDownloadAll: () => void
  onImportFile: () => void
  onMigrateGuest: () => void
}

// Maps lang key -> CSS variable color
const LANG_COLORS: Record<string, string> = {
  js: 'var(--lang-js)',
  ts: 'var(--lang-ts)',
  py: 'var(--lang-py)',
  css: 'var(--lang-css)',
  bash: 'var(--lang-bash)',
  sql: 'var(--lang-sql)',
  html: 'var(--lang-html)',
  json: 'var(--lang-json)',
  other: 'var(--lang-other)',
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Sidebar({
  snippets, currentId, isGuest, onSelect, onNew, onImported, search, onSearch, 
  activeTag, onTagClick, onLogoClick, onDownloadAll, onImportFile, onMigrateGuest,
}: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [visibleSnippets, setVisibleSnippets] = useState<Snippet[]>(snippets)
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())
  const [hasLocalSnippets, setHasLocalSnippets] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setSession(session)
    )

    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))

    return () => subscription.unsubscribe()
  }, [])

  // Close avatar menu on outside click
  useEffect(() => {
    if (!menuOpen) return

    const handler = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpen])

  useEffect(() => {
    const currentIds = new Set(snippets.map(s => s.id))

    // Find items that are leaving
    const leaving = visibleSnippets.filter(s => !currentIds.has(s.id))

    if (leaving.length === 0) {
      setVisibleSnippets(snippets)
      return
    }

    // Mark them as exiting
    setExitingIds(new Set(leaving.map(s => s.id)))

    // Remove them after animation completes
    setTimeout(() => {
      setVisibleSnippets(snippets)
      setExitingIds(new Set())
    }, 220)
  }, [snippets])

  // Check for local snippets when the session changes
  useEffect(() => {
    if (session) {
      setHasLocalSnippets(getGuestSnippets().length > 0)
    }
  }, [session])

  const allTags = [...new Set(snippets.flatMap(s => s.tags))]
  const avatarUrl = session?.user?.user_metadata?.avatar_url
  const userName = session?.user?.user_metadata?.user_name ?? session?.user?.email ?? ''

  return (
    <>
      <aside className={styles.sidebar}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logoGroup}>
            <div className={styles.logo} onClick={onLogoClick}>
              <div className={styles.logoDot} />
              Kofee
            </div>
            <div className={styles.logoSub}>your brew of code</div>
          </div>
          {/* Avatar menu */}
          <div className={styles.avatarMenuWrapper}>
            <div
              className={styles.avatarButton}
              onClick={e => {
                e.stopPropagation()
                setMenuOpen(v => !v)
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt={userName} className={styles.avatarImage} />
                : userName[0]?.toUpperCase()
              }
            </div>

            {menuOpen && (
              <div ref={menuRef} className={styles.avatarMenu} onClick={e => e.stopPropagation()}>
                <div className={styles.avatarMenuInfo}>
                  <div className={styles.avatarMenuName}>
                    {isGuest ? "Guest" : userName}
                  </div>
                  <div className={styles.avatarMenuEmail}>
                    {session?.user?.email ?? "Sign in to get more features!"}
                  </div>
                </div>
                <div className={styles.avatarMenuLinks}>
                  <a
                    href="https://github.com/hxpe-dev/kofee"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.avatarMenuLink}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    GitHub
                  </a>
                  <a
                    href="https://ko-fi.com/hxpedev"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.avatarMenuLink}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
                    </svg>
                    Support us
                  </a>
                </div>
                <button
                  className={styles.avatarMenuDownload}
                  onClick={() => { 
                    onDownloadAll()
                    setMenuOpen(false)
                  }}
                >
                  <IconDownload/>
                  Download all
                </button>
                {session && hasLocalSnippets && (
                  <button
                    className={styles.avatarMenuDownload}
                    onClick={() => {
                      onMigrateGuest()
                      setMenuOpen(false)
                    }}
                  >
                    <IconDoubleArrows/>
                    Import local snippets
                  </button>
                )}
                <button
                  className={styles.avatarMenuSignOut}
                  onClick={() => {
                    if(!isGuest) {
                      supabase.auth.signOut()
                    } else {
                      // Guest: remove ?guest param and go to login
                      window.location.href = '/'
                    }
                  }}
                >
                  <IconSignOut/>
                  {!isGuest ? 'Sign out' : 'Back to login'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search snippets..."
          />
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <>
            <div className={styles.sectionLabel}>Tags</div>
            <div className={styles.tagList}>
              {allTags.map(tag => (
                <div
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  className={`${styles.tagPill} ${activeTag === tag ? styles.tagPillActive : ''}`}
                >
                  {tag}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Snippet list */}
        <div className={styles.sectionLabel}>Snippets</div>
        <div className={styles.snippetList}>
          {visibleSnippets.length === 0 && (search || activeTag) ? (
            <div className={styles.emptySearch}>
              <div className={styles.emptySearchText}>No snippets found</div>
              <div className={styles.emptySearchSub}>
                {search ? `Nothing matching "${search}"` : `No snippets tagged "${activeTag}"`}
              </div>
            </div>
          ) : (
            visibleSnippets.map((s, i) => (
              <div
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`
                  ${styles.snippetItem}
                  ${s.id === currentId ? styles.snippetItemActive : ''}
                  ${exitingIds.has(s.id) ? styles.snippetItemExit : ''}
                `}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className={styles.snippetTitle}>{s.title}</div>
                <div className={styles.snippetMeta}>
                  <span
                    className={styles.langBadge}
                    style={{
                      background: `color-mix(in srgb, ${LANG_COLORS[s.lang] ?? 'var(--lang-other)'} 15%, transparent)`,
                      color: LANG_COLORS[s.lang] ?? 'var(--lang-other)',
                    }}
                  >
                    {s.lang}
                  </span>
                  <span className={styles.snippetAge}>{timeAgo(s.updated_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={onNew}>
            + New Snippet
          </button>
          <button className={styles.btnSecondary} onClick={onImportFile}>
            ↑ Import from file
          </button>
          {!isGuest && (
            <button className={styles.btnSecondary} onClick={() => setImportOpen(true)}>
              ↓ Import from Gist
            </button>
          )}
        </div>
      </aside>

      {/* Import modal lives here, outside <aside> */}
      {importOpen && (
        <ImportModal
          onImported={onImported}
          onClose={() => setImportOpen(false)}
        />
      )}
    </>
  )
}