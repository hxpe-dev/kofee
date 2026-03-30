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
import { IconExpand, IconDownload, IconCopy, IconTrash, IconGist } from '@/components/icons'

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
  const [pushingGist, setPushingGist] = useState(false)
  const [importingGist, setImportingGist] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mobileView, setMobileView] = useState<'sidebar' | 'editor'>('sidebar')

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Verify the user is authentic
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setSession(session)
      } else {
        setSession(null)
      }
      
      if (session?.provider_token && user?.id) {
        const encrypted = await encryptToken(session.provider_token)
        await supabase.from('user_tokens').upsert({
          user_id: user.id,
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    const { data } = await supabase
      .from('snippets')
      .select('*')
      .eq('user_id', user.id)
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
    if (isMobile) setMobileView('editor')
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return

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
      user_id: user.id,
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    const { data, error } = await supabase.from('snippets').insert({
      user_id: user.id,
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id || importingGist) return
    setImportingGist(true)
    const { data, error } = await supabase.from('snippets').insert({
      user_id: user.id,
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

    setImportingGist(false)
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
    if (!currentId || pushingGist) return
    setPushingGist(true)
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
      if (data.error) {
        showToast(data.error)
      } else {
        showToast('Failed to create Gist')
      }
    }
    setPushingGist(false)
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


  // throw new Error('Test error')

  // Render
  return (
    <div
      className={styles.app}
      data-mobile-view={mobileView}
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
          setMobileView('sidebar')
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
              <button
                className={styles.btnMobileBack}
                onClick={() => setMobileView('sidebar')}
              >
                ← Back
              </button>
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
                <button
                  className={styles.btnActionPrimary}
                  onClick={pushToGist}
                  disabled={pushingGist}
                  style={{ opacity: pushingGist ? 0.6 : 1 }}
                >
                  <IconGist /> {pushingGist ? 'Pushing...' : 'Push to Gist'}
                </button>
                <button
                  className={confirmDelete ? styles.btnActionDanger : styles.btnAction}
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true)
                      setTimeout(() => setConfirmDelete(false), 3000)
                      return
                    }
                    deleteSnippet()
                    setConfirmDelete(false)
                  }}
                >
                  <IconTrash /> {confirmDelete ? 'Confirm?' : ''}
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
              <div className={styles.mobileReadOnly}>
                Best experienced on desktop
              </div>
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
            {isMobile ? (
              <button className={styles.brewClose} onClick={() => setBrewOpen(false)}>
                exit brew
              </button>
            ) : (
              <button className={styles.brewClose} onClick={() => setBrewOpen(false)}>
                esc · exit brew
              </button>
            )}           
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