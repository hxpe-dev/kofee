'use client'

import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Snippet } from '@/types/snippet'
import ImportModal from './ImportModal'
import styles from '@/styles/sidebar.module.css'
import { IconDoubleArrows, IconDownload, IconGist, IconKofi, IconSignOut } from './icons'
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
  rs: 'var(--lang-rs)',
  css: 'var(--lang-css)',
  bash: 'var(--lang-bash)',
  sql: 'var(--lang-sql)',
  html: 'var(--lang-html)',
  json: 'var(--lang-json)',
  java: 'var(--lang-java)',
  cs: 'var(--lang-cs)',
  cpp: 'var(--lang-cpp)',
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
                    <IconGist/>
                    GitHub
                  </a>
                  <a
                    href="https://ko-fi.com/hxpedev"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.avatarMenuLink}
                  >
                    <IconKofi/>
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