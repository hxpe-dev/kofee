'use client'

import { Snippet } from '@/types/snippet'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

interface Props {
  snippets: Snippet[]
  currentId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onImported: (snippet: { title: string; code: string; lang: string; gist_url: string }) => void
  search: string
  onSearch: (v: string) => void
  activeTag: string | null
  onTagClick: (tag: string) => void
}

const LANG_COLORS: Record<string, string> = {
  js:   '#d4b84a', ts: '#5a8adc', py: '#6aaad0',
  css:  '#7aaae0', bash: '#7daa7a', sql: '#d09060',
  html: '#d08060', json: '#a0a0a0', other: '#807060',
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
  snippets, currentId, onSelect, onNew, onImported,
  search, onSearch, activeTag, onTagClick,
}: Props) {
  const [session, setSession]       = useState<Session | null>(null)
  const [hoveredId, setHoveredId]   = useState<string | null>(null)
  const [menuOpen, setMenuOpen]     = useState(false)

  // Import modal state
  const [importOpen, setImportOpen] = useState(false)
  const [gistUrl, setGistUrl]       = useState('')
  const [importing, setImporting]   = useState(false)
  const [importError, setImportError] = useState('')

  // Multi-file picker state
  const [pickerFiles, setPickerFiles] = useState<{ filename: string; content: string; language: string }[]>([])
  const [pickerTitle, setPickerTitle] = useState('')
  const [pickerGistUrl, setPickerGistUrl] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = () => setMenuOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpen])

  const allTags = [...new Set(snippets.flatMap(s => s.tags))]

  async function handleImport() {
    if (!gistUrl.trim()) return
    setImporting(true)
    setImportError('')

    const res = await fetch('/api/gist/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gistUrl: gistUrl.trim() }),
    })

    const data = await res.json()
    setImporting(false)

    if (!res.ok) {
      setImportError(data.error ?? 'Something went wrong')
      return
    }

    if (data.files.length === 1) {
      // Single file — import directly
      onImported({
        title:    data.title,
        code:     data.files[0].content,
        lang:     data.files[0].language,
        gist_url: data.gist_url,
      })
      closeImportModal()
    } else {
      // Multiple files — show picker
      setPickerFiles(data.files)
      setPickerTitle(data.title)
      setPickerGistUrl(data.gist_url)
    }
  }

  function handlePickFile(file: { filename: string; content: string; language: string }) {
    onImported({
      title:    file.filename,
      code:     file.content,
      lang:     file.language,
      gist_url: pickerGistUrl,
    })
    closeImportModal()
  }

  function closeImportModal() {
    setImportOpen(false)
    setGistUrl('')
    setImportError('')
    setImporting(false)
    setPickerFiles([])
    setPickerTitle('')
    setPickerGistUrl('')
  }

  const avatarUrl = session?.user?.user_metadata?.avatar_url
  const userName  = session?.user?.user_metadata?.user_name ?? session?.user?.email ?? ''

  return (
    <>
      <style>{`
        @keyframes snippetFadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <aside style={{
        width: '260px', minWidth: '260px',
        background: 'var(--bg2)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden',
      }}>

        {/* Header with avatar menu */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            fontFamily: 'var(--font-lora), serif',
            fontSize: '22px', fontWeight: 500,
            color: 'var(--accent2)', letterSpacing: '-0.3px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
            Kofee
          </div>

          {/* Avatar button */}
          <div style={{ position: 'relative' }}>
            <div
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--surface)',
                border: '1px solid var(--border2)',
                cursor: 'pointer', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', color: 'var(--text-dim)',
                transition: 'border-color 0.2s',
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : userName[0]?.toUpperCase()
              }
            </div>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', top: '36px', right: 0,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)',
                  borderRadius: '10px', padding: '6px',
                  minWidth: '160px', zIndex: 50,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  animation: 'modalIn 0.15s ease',
                }}
              >
                <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 500 }}>{userName}</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-faint)', marginTop: '1px' }}>{session?.user?.email}</div>
                </div>
                <div
                  onClick={() => supabase.auth.signOut()}
                  style={{
                    padding: '7px 10px', borderRadius: '6px',
                    fontSize: '11px', color: 'var(--text-dim)',
                    cursor: 'pointer', transition: 'background 0.15s',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,80,80,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Sign out
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search snippets..."
            style={{
              width: '100%', background: 'var(--surface)',
              border: '1px solid var(--border2)', borderRadius: '8px',
              padding: '8px 12px', color: 'var(--text)',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
              outline: 'none',
            }}
          />
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <>
            <div style={{ padding: '14px 20px 6px', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
              Tags
            </div>
            <div style={{ padding: '0 12px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {allTags.map(tag => (
                <div
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  style={{
                    background: activeTag === tag ? 'rgba(200,150,90,0.2)' : 'rgba(200,150,90,0.08)',
                    border: `1px solid ${activeTag === tag ? 'rgba(200,150,90,0.35)' : 'var(--border2)'}`,
                    borderRadius: '20px', padding: '3px 10px', fontSize: '10px',
                    color: activeTag === tag ? 'var(--accent2)' : 'var(--text-dim)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Snippet list label */}
        <div style={{ fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text-faint)', textTransform: 'uppercase', padding: '8px 20px 4px' }}>
          Snippets
        </div>

        {/* Snippet list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
          {snippets.map((s, i) => {
            const isActive  = s.id === currentId
            const isHovered = hoveredId === s.id
            return (
              <div
                key={s.id}
                onClick={() => onSelect(s.id)}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  padding: '12px', borderRadius: '10px', cursor: 'pointer', marginBottom: '4px',
                  transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
                  border: isActive
                    ? '1px solid rgba(200,150,90,0.35)'
                    : isHovered
                      ? '1px solid rgba(200,150,90,0.2)'
                      : '1px solid rgba(210,170,120,0.08)',
                  background: isActive
                    ? 'var(--surface)'
                    : isHovered ? 'rgba(200,150,90,0.06)' : 'transparent',
                  boxShadow: isActive
                    ? '0 0 0 1px rgba(200,150,90,0.1), inset 0 1px 0 rgba(200,150,90,0.05)'
                    : isHovered
                      ? '0 0 12px rgba(200,150,90,0.08), inset 0 1px 0 rgba(200,150,90,0.04)'
                      : 'none',
                  animation: 'snippetFadeIn 0.25s ease both',
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-lora), serif', fontSize: '13px',
                  color: isHovered && !isActive ? 'var(--accent2)' : 'var(--text)',
                  marginBottom: '4px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  transition: 'color 0.2s',
                }}>
                  {s.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 500, letterSpacing: '0.05em',
                    padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase',
                    background: `${LANG_COLORS[s.lang]}22`,
                    color: LANG_COLORS[s.lang] ?? 'var(--text-dim)',
                  }}>
                    {s.lang}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-faint)', marginLeft: 'auto' }}>
                    {timeAgo(s.updated_at)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Action buttons */}
        <div style={{ padding: '10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={onNew}
            style={{
              width: '100%', background: 'var(--accent)', color: 'var(--bg)',
              border: 'none', borderRadius: '8px', padding: '9px 0',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
              fontWeight: 500, cursor: 'pointer', letterSpacing: '0.04em',
              transition: 'background 0.2s',
            }}
          >
            + New Snippet
          </button>
          <button
            onClick={() => setImportOpen(true)}
            style={{
              width: '100%', background: 'transparent', color: 'var(--text-dim)',
              border: '1px solid var(--border2)', borderRadius: '8px', padding: '8px 0',
              fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
              cursor: 'pointer', letterSpacing: '0.04em',
              transition: 'border-color 0.2s, color 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(200,150,90,0.35)'
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border2)'
              e.currentTarget.style.color = 'var(--text-dim)'
            }}
          >
            ↓ Import from Gist
          </button>
        </div>
      </aside>

      {/* Import modal */}
      {importOpen && (
        <div
          onClick={closeImportModal}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,10,8,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              borderRadius: '14px',
              padding: '28px',
              width: '420px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
              animation: 'modalIn 0.2s ease',
            }}
          >
            {pickerFiles.length === 0 ? (
              // ── URL input view ──────────────────────────────────
              <>
                <div style={{ fontFamily: 'var(--font-lora), serif', fontSize: '17px', color: 'var(--text)', marginBottom: '6px' }}>
                  Import from Gist
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '20px', lineHeight: 1.6 }}>
                  Paste a GitHub Gist URL to import it as a snippet.
                </div>

                <input
                  autoFocus
                  value={gistUrl}
                  onChange={e => { setGistUrl(e.target.value); setImportError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleImport()}
                  placeholder="https://gist.github.com/user/abc123"
                  style={{
                    width: '100%', background: 'var(--surface)',
                    border: `1px solid ${importError ? 'rgba(200,100,100,0.5)' : 'var(--border2)'}`,
                    borderRadius: '8px', padding: '10px 14px',
                    color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px', outline: 'none', marginBottom: '8px',
                  }}
                />

                {importError && (
                  <div style={{ fontSize: '11px', color: '#c87a6a', marginBottom: '12px' }}>
                    {importError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    onClick={closeImportModal}
                    style={{
                      flex: 1, background: 'transparent', border: '1px solid var(--border2)',
                      borderRadius: '8px', padding: '9px 0', color: 'var(--text-faint)',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing || !gistUrl.trim()}
                    style={{
                      flex: 2, background: importing ? 'var(--surface)' : 'var(--accent)',
                      border: 'none', borderRadius: '8px', padding: '9px 0',
                      color: importing ? 'var(--text-faint)' : 'var(--bg)',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
                      fontWeight: 500, cursor: importing ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    {importing ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </>
            ) : (
              // ── Multi-file picker view ──────────────────────────
              <>
                <div style={{ fontFamily: 'var(--font-lora), serif', fontSize: '17px', color: 'var(--text)', marginBottom: '4px' }}>
                  Pick a file
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '16px', lineHeight: 1.6 }}>
                  This Gist has multiple files. Which one do you want to import?
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                  {pickerFiles.map(file => (
                    <div
                      key={file.filename}
                      onClick={() => handlePickFile(file)}
                      style={{
                        padding: '10px 14px', borderRadius: '8px',
                        border: '1px solid var(--border2)',
                        background: 'var(--surface)',
                        cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(200,150,90,0.35)'
                        e.currentTarget.style.background = 'rgba(200,150,90,0.08)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border2)'
                        e.currentTarget.style.background = 'var(--surface)'
                      }}
                    >
                      <span style={{ fontSize: '12px', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {file.filename}
                      </span>
                      <span style={{
                        fontSize: '9px', padding: '1px 6px', borderRadius: '4px',
                        background: `${LANG_COLORS[file.language] ?? '#807060'}22`,
                        color: LANG_COLORS[file.language] ?? 'var(--text-dim)',
                        textTransform: 'uppercase', fontWeight: 500, letterSpacing: '0.05em',
                      }}>
                        {file.language}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={closeImportModal}
                  style={{
                    width: '100%', background: 'transparent', border: '1px solid var(--border2)',
                    borderRadius: '8px', padding: '8px 0', color: 'var(--text-faint)',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}