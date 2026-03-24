'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { encryptToken } from '@/lib/crypto'
import { Snippet } from '@/types/snippet'
import LoginScreen from '@/components/LoginScreen'
import Sidebar from '@/components/Sidebar'
import CodeEditor from '@/components/CodeEditor'
import styles from '@/styles/page.module.css'
import { strToU8, zip } from 'fflate'
import type { AsyncZippable, GzipOptions } from 'fflate'

const LANGS = ['js','ts','py','css','bash','sql','html','json','other']

const EXTENSIONS: Record<string, string> = {
  js: 'js',
  ts: 'ts',
  py: 'py',
  css: 'css',
  bash: 'sh',
  sql: 'sql',
  html: 'html',
  json: 'json',
  other: 'txt'
}

// Icons
function IconExpand() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"/>
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
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
  const [dragging, setDragging] = useState(false)

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.provider_token && session?.user?.id) {
        const encrypted = await encryptToken(session.provider_token)
        await supabase.from('user_tokens').upsert({
          user_id: session.user.id,
          github_token: encrypted,
          updated_at: new Date().toISOString(),
        })
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Handle keybinds
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement

      // Enter in title input -> focus code editor
      if (e.key === 'Enter' && active?.classList.contains(styles.titleInput)) {
        e.preventDefault()
        const editor = document.querySelector<HTMLElement>('.cm-content')
        editor?.focus()
        return
      }

      // Ignore shortcuts when typing in an input/textarea
      const isTyping = ['INPUT', 'TEXTAREA'].includes(active?.tagName)
        || active?.classList.contains('cm-content')
      if (isTyping) return

      // N -> new snippet
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        newSnippet()
        return
      }

      // S -> force save current snippet
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        if (currentId) saveSnippet(currentId, { title, code, lang, tags })
        return
      }

      // B -> brew mode
      if (e.key === 'b' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        if (currentId) setBrewOpen(v => !v)
        return
      }

      // Escape -> exit brew mode (when in brew mode)
      if (e.key === 'Escape' && brewOpen) {
        setBrewOpen(false) 
        return
      }

      // Escape -> deselect snippet (when not in brew mode)
      if (e.key === 'Escape' && !brewOpen) {
        setCurrentId(null)
        setTitle(''); setCode(''); setLang('js'); setTags([])
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [currentId, brewOpen, title, code, lang, tags])

  // Close lang drop down on outside click
  useEffect(() => {
    if (!langOpen) return
    const handler = () => setLangOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [langOpen])

  // Load snippets
  const loadSnippets = useCallback(async () => {
    if (!session?.user?.id) return
    const { data } = await supabase
      .from('snippets')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
    if (data) setSnippets(data)
  }, [session?.user?.id])

  useEffect(() => { 
    loadSnippets()
  }, [loadSnippets])

  // Select snippet
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

  // Save
  async function saveSnippet(id: string, patch: Partial<Snippet>) {
    setSaving(true)
    const slowTimer = setTimeout(() => showToast('Saving is taking longer than usual...'), 3000)
    await supabase
      .from('snippets')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    clearTimeout(slowTimer)
    await loadSnippets()
    setSaving(false)
  }

  // Handle file import
  async function handleFileImport(file: File) {
    if (!session?.user?.id) return

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const extToLang: Record<string, string> = {
      js: 'js',
      jsx: 'js',
      mjs: 'js',
      ts: 'ts',
      tsx: 'ts',
      py: 'py',
      css: 'css',
      scss: 'css',
      html: 'html',
      htm: 'html',
      json: 'json',
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      sql: 'sql',
    }

    const code = await file.text()
    const lang = extToLang[ext] ?? 'other'
    const title = file.name.replace(/\.[^.]+$/, '') // strip extension

    const { data, error } = await supabase.from('snippets').insert({
      user_id: session.user.id,
      title,
      code,
      lang,
      tags: [],
    }).select().single()

    if (error) {
      if (error.message.includes('Snippet limit reached')) {
        showToast('Snippet limit reached (100 max)')
      } else {
        showToast('Failed to create snippet')
      }
      return
    }

    if (data) {
      await loadSnippets()
      setCurrentId(data.id)
      setTitle(data.title)
      setCode(data.code)
      setLang(data.lang)
      setTags([])
      showToast(`Imported ${file.name}`)
    }
  }

  // Handle any change in the snippet (title, code, lang) with automatic save after a short delay
  function handleFieldChange(field: string, value: string) {
    if (field === 'title') setTitle(value)
    if (field === 'code')  setCode(value)
    if (field === 'lang')  setLang(value)
    if (!currentId) return
    if (saveTimer) clearTimeout(saveTimer)
    setSaveTimer(setTimeout(() => saveSnippet(currentId, { [field]: value }), 800))
  }

  // New snippet
  async function newSnippet() {
    if (!session?.user?.id) return
    const { data, error } = await supabase.from('snippets').insert({
      user_id: session.user.id,
      title: 'Untitled snippet',
      code: '',
      lang: 'js',
      tags: [],
    }).select().single()

    if (error) {
      if (error.message.includes('Snippet limit reached')) {
        showToast('Snippet limit reached (100 max)')
      } else {
        showToast('Failed to create snippet')
      }
      return
    }

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
        if (input) {
          input.focus()
          input.select()
        }
      }, 50)
    }
  }

  // Delete snippet
  async function deleteSnippet() {
    if (!currentId) return
    await supabase.from('snippets').delete().eq('id', currentId)
    setCurrentId(null)
    setTitle('')
    setCode('')
    setLang('js')
    setTags([])
    await loadSnippets()
    showToast('Snippet deleted')
  }

  // Import from Gist
  async function handleImported(snippet: { title: string; code: string; lang: string; gist_url: string }) {
    if (!session?.user?.id) return
    const { data, error } = await supabase.from('snippets').insert({
      user_id: session.user.id,
      title: snippet.title,
      code: snippet.code,
      lang: snippet.lang,
      tags: [],
      gist_url: snippet.gist_url,
    }).select().single()

    if (error) {
      if (error.message.includes('Snippet limit reached')) {
        showToast('Snippet limit reached (100 max)')
      } else {
        showToast('Failed to create snippet')
      }
      return
    }

    if (data) {
      await loadSnippets()
      setCurrentId(data.id)
      setTitle(data.title)
      setCode(data.code)
      setLang(data.lang)
      setTags([])
      showToast('Gist imported')
    }
  }

  // Tags
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

  // Push to Gist
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
      showToast('Gist created, opening...')
      window.open(data.url, '_blank')
    } else {
      showToast('Failed to create Gist')
    }
  }

  // Copy
  function copyCode() {
    navigator.clipboard.writeText(code)
    showToast('Copied to clipboard')
  }

  // Download single
  function downloadSnippet() {
    const ext = EXTENSIONS[lang] ?? 'txt'
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Downloaded')
  }

  // Download all
  function downloadAllSnippets() {
    const files: AsyncZippable = {}

    snippets.forEach(s => {
      const ext = EXTENSIONS[s.lang] ?? 'txt'
      const safeName = s.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()
      
      let filename = `${safeName}.${ext}`
      let counter = 1
      while (Object.hasOwn(files, filename)) {
        filename = `${safeName}-${counter}.${ext}`
        counter++
      }

      const opts: GzipOptions = { mtime: new Date(s.updated_at) }
      files[filename] = [strToU8(s.code), opts]
    })

    // Also include a metadata JSON
    const meta = snippets.map(s => ({
      title: s.title,
      lang: s.lang,
      tags: s.tags,
      gist_url: s.gist_url,
      created_at: s.created_at,
    }))

    files['kofee-metadata.json'] = [
      strToU8(JSON.stringify(meta, null, 2)),
      { mtime: new Date() } as GzipOptions
    ]

    zip(files, (err, data) => {
      if (err) { showToast('Export failed'); return }
      const blob = new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kofee-snippets-${new Date().toISOString().split('T')[0]}.zip`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`Downloaded ${snippets.length} snippets`)
    })
  }

  // Toast
  function showToast(msg: string) {
    setToast(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2000) // start fade out
    setTimeout(() => setToast(''), 2300) // remove after fade
  }

  // Filter snippets based on search (in title and in code) and active tag
  const filtered = snippets
    .filter(s => !activeTag || s.tags.includes(activeTag))
    .filter(s => !search
      || s.title.toLowerCase().includes(search.toLowerCase())
      || s.code.toLowerCase().includes(search.toLowerCase())
    )

  const currentSnippet = snippets.find(s => s.id === currentId)

  // Auth guards
  if (loading) {
    return (
      <div className={styles.loading}>
        brewing...
      </div>
    )
  } 
  if (!session) return <LoginScreen />

  // Render
  return (
    <div
      className={styles.app}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFileImport(file)
      }}
    >
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
          setTitle('')
          setCode('')
          setLang('js')
          setTags([])
        }}
        onDownloadAll={downloadAllSnippets}
        onImportFile={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.js,.jsx,.ts,.tsx,.py,.css,.scss,.html,.json,.sh,.bash,.sql,.txt,.md,.other'
          input.onchange = e => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) handleFileImport(file)
          }
          input.click()
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
                <button className={styles.btnAction} onClick={downloadSnippet}>
                  <IconDownload /> Download
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

      {dragging && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropContent}>
            <div className={styles.dropIcon}>
              <IconDownload />
            </div>
            <div className={styles.dropTitle}>Drop your file</div>
            <div className={styles.dropSub}>Any code file - js, ts, py, css, sql and more</div>
          </div>
        </div>
      )}
    </div>
  )
}