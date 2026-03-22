'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Snippet } from '@/types/snippet'
import LoginScreen from '@/components/LoginScreen'
import Sidebar from '@/components/Sidebar'
import CodeEditor from '@/components/CodeEditor'
import styles from '@/styles/page.module.css'

const LANGS = ['js','ts','py','css','bash','sql','html','json','other']

// ── Icons ─────────────────────────────────────────────────────────
function IconExpand() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"/>
    </svg>
  )
}

function IconCopy() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
    </svg>
  )
}

function IconGist() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [lang, setLang] = useState('js')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [brewOpen, setBrewOpen] = useState(false)
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [langOpen, setLangOpen] = useState(false)

  // ── Auth ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Escape closes brew mode ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setBrewOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Close lang drop down on outside click
  useEffect(() => {
    if (!langOpen) return
    const handler = () => setLangOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [langOpen])

  // ── Load snippets ──────────────────────────────────────────────
  const loadSnippets = useCallback(async () => {
    if (!session?.user?.id) return
    const { data } = await supabase
      .from('snippets')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
    if (data) setSnippets(data)
  }, [session?.user?.id])

  useEffect(() => { loadSnippets() }, [loadSnippets])

  // ── Select snippet ─────────────────────────────────────────────
  function selectSnippet(id: string) {
    const s = snippets.find(x => x.id === id)
    if (!s) return
    setCurrentId(id)
    setTitle(s.title)
    setCode(s.code)
    setLang(s.lang)
    setTags(s.tags)
    setTagInput('')
  }

  // ── Save ───────────────────────────────────────────────────────
  async function saveSnippet(id: string, patch: Partial<Snippet>) {
    setSaving(true)
    await supabase
      .from('snippets')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    await loadSnippets()
    setSaving(false)
  }

  function handleFieldChange(field: string, value: string) {
    if (field === 'title') setTitle(value)
    if (field === 'code')  setCode(value)
    if (field === 'lang')  setLang(value)
    if (!currentId) return
    if (saveTimer) clearTimeout(saveTimer)
    setSaveTimer(setTimeout(() => saveSnippet(currentId, { [field]: value }), 800))
  }

  // ── New snippet ────────────────────────────────────────────────
  async function newSnippet() {
    if (!session?.user?.id) return
    const { data } = await supabase.from('snippets').insert({
      user_id: session.user.id,
      title: 'Untitled snippet',
      code: '', lang: 'js', tags: [],
    }).select().single()

    if (data) {
      await loadSnippets()
      setCurrentId(data.id)
      setTitle(data.title)
      setCode(data.code)
      setLang(data.lang)
      setTags(data.tags)
      setTagInput('')
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(`.${styles.titleInput}`)
        if (input) { input.focus(); input.select() }
      }, 50)
    }
  }

  // ── Delete snippet ─────────────────────────────────────────────
  async function deleteSnippet() {
    if (!currentId) return
    await supabase.from('snippets').delete().eq('id', currentId)
    setCurrentId(null)
    setTitle(''); setCode(''); setLang('js'); setTags([])
    await loadSnippets()
    showToast('Snippet deleted')
  }

  // ── Import from Gist ───────────────────────────────────────────
  async function handleImported(snippet: { title: string; code: string; lang: string; gist_url: string }) {
    if (!session?.user?.id) return
    const { data } = await supabase.from('snippets').insert({
      user_id:  session.user.id,
      title:    snippet.title,
      code:     snippet.code,
      lang:     snippet.lang,
      tags:     [],
      gist_url: snippet.gist_url,
    }).select().single()

    if (data) {
      await loadSnippets()
      setCurrentId(data.id)
      setTitle(data.title)
      setCode(data.code)
      setLang(data.lang)
      setTags([])
      showToast('✓ Gist imported')
    }
  }

  // ── Tags ───────────────────────────────────────────────────────
  async function addTag(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || !tagInput.trim() || !currentId) return
    const newTags = [...new Set([...tags, tagInput.trim().toLowerCase()])]
    setTags(newTags)
    setTagInput('')
    await saveSnippet(currentId, { tags: newTags })
  }

  async function removeTag(tag: string) {
    if (!currentId) return
    const newTags = tags.filter(t => t !== tag)
    setTags(newTags)
    await saveSnippet(currentId, { tags: newTags })
  }

  // ── Push to Gist ───────────────────────────────────────────────
  async function pushToGist() {
    if (!currentId) return
    showToast('Pushing to Gist...')
    const res = await fetch('/api/gist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, code, lang }),
    })
    const data = await res.json()
    if (data.url) {
      await saveSnippet(currentId, { gist_url: data.url })
      showToast('✓ Gist created — opening...')
      window.open(data.url, '_blank')
    } else {
      showToast('Failed to create Gist')
    }
  }

  // ── Copy ───────────────────────────────────────────────────────
  function copyCode() {
    navigator.clipboard.writeText(code)
    showToast('Copied to clipboard')
  }

  // ── Toast ──────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2000) // start fade out
    setTimeout(() => setToast(''), 2300)           // remove after fade
  }

  // ── Filter ─────────────────────────────────────────────────────
  const filtered = snippets
    .filter(s => !activeTag || s.tags.includes(activeTag))
    .filter(s => !search
      || s.title.toLowerCase().includes(search.toLowerCase())
      || s.code.toLowerCase().includes(search.toLowerCase())
    )

  const currentSnippet = snippets.find(s => s.id === currentId)

  // ── Auth guards ────────────────────────────────────────────────
  if (loading)  return <div className={styles.loading}>brewing...</div>
  if (!session) return <LoginScreen />

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className={styles.app}>
      <Sidebar
        snippets={filtered}
        currentId={currentId}
        onSelect={selectSnippet}
        onNew={newSnippet}
        onImported={handleImported}
        search={search}
        onSearch={setSearch}
        activeTag={activeTag}
        onTagClick={t => setActiveTag(activeTag === t ? null : t)}
        onLogoClick={() => {
          setCurrentId(null)
          setTitle(''); setCode(''); setLang('js'); setTags([])
        }}
      />

      <main className={styles.editorArea}>
        {!currentId ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>☕</div>
            <div className={styles.emptyTitle}>Nothing brewing yet</div>
            <div className={styles.emptySub}>Select a snippet or create a new one</div>
          </div>
        ) : (
          <div className={styles.snippetView}>
            {/* Top bar */}
            <div className={styles.topbar}>
              <input
                className={styles.titleInput}
                value={title}
                onChange={e => handleFieldChange('title', e.target.value)}
                placeholder="Snippet title..."
              />
              <div className={styles.topbarActions}>
                <button className={styles.btnAction} onClick={copyCode}>
                  <IconCopy /> Copy
                </button>
                <button className={styles.btnAction} onClick={() => setBrewOpen(true)}>
                  <IconExpand /> Brew
                </button>
                <button className={styles.btnActionPrimary} onClick={pushToGist}>
                  <IconGist /> Push to Gist
                </button>
                <button className={styles.btnAction} onClick={deleteSnippet}>
                  <IconTrash />
                </button>
              </div>
            </div>

            {/* Meta bar */}
            <div className={styles.metabar}>
              <div style={{ position: 'relative' }}>
                <button
                  className={styles.langButton}
                  onClick={() => setLangOpen(v => !v)}
                >
                  {lang} <span className={styles.langChevron}>▾</span>
                </button>

                {langOpen && (
                  <div className={styles.langDropdown}>
                    {LANGS.map(l => (
                      <div
                        key={l}
                        className={`${styles.langOption} ${l === lang ? styles.langOptionActive : ''}`}
                        onClick={() => {
                          handleFieldChange('lang', l)
                          setLangOpen(false)
                        }}
                      >
                        {l}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <input
                className={styles.tagInput}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={addTag}
                placeholder="Add tag, press Enter..."
              />

              {tags.map(tag => (
                <span key={tag} className={styles.tag} onClick={() => removeTag(tag)}>
                  {tag} ×
                </span>
              ))}

              {currentSnippet?.gist_url && (
                <a
                  href={currentSnippet.gist_url}
                  target="_blank" rel="noreferrer"
                  className={styles.gistLink}
                >
                  ↗ view gist
                </a>
              )}
            </div>

            {/* Code editor */}
            <div key={`code-${currentId}`} className={styles.codeAnimate}>
              <CodeEditor
                value={code}
                lang={lang}
                onChange={value => handleFieldChange('code', value)}
              />
            </div>

            {/* Status bar */}
            <div className={styles.statusbar}>
              <span className={styles.statusItem}>
                Lines: <span className={styles.statusValue}>{code.split('\n').length}</span>
              </span>
              <span className={styles.statusItem}>
                Chars: <span className={styles.statusValue}>{code.length}</span>
              </span>
              <span className={styles.statusSaved}>
                {saving ? 'saving...' : '✓ saved'}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Brew mode overlay */}
      {brewOpen && (
        <div className={styles.brewOverlay}>
          <div className={styles.brewHeader}>
            <span className={styles.brewTitle}>{title}</span>
            <button className={styles.brewClose} onClick={() => setBrewOpen(false)}>
              esc · exit brew
            </button>
          </div>
          <CodeEditor
            value={code}
            lang={lang}
            onChange={value => handleFieldChange('code', value)}
          />
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${!toastVisible ? styles.toastOut : ''}`}>
          {toast}
        </div>
      )}
    </div>
  )
}