'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
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
import { IconExpand, IconDownload, IconCopy, IconTrash, IconGist, IconShare } from '@/components/icons'
import { getGuestSnippets, saveGuestSnippets, clearGuestSnippets, createGuestSnippet } from '@/lib/guestSnippets'
import MigrateModal from '@/components/MigrateModal'

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
  const [langOpen, setLangOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pushingGist, setPushingGist] = useState(false)
  const [importingGist, setImportingGist] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [migrateModal, setMigrateModal] = useState(false)
  const [mobileView, setMobileView] = useState<'sidebar' | 'editor'>('sidebar')
  const [isMobile, setIsMobile] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  
  const lastSaveId = useRef(0)
  const lastToken = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setIsGuest(new URLSearchParams(window.location.search).get('guest') === 'true')
  }, [])
  
  // Auth
  useEffect(() => {
    let mounted = true

    async function init() {
      // console.log('[AUTH] init() called')
      const { data: { session }, error } = await supabase.auth.getSession()
      // console.log('[AUTH] getSession result:', { session, error })
      if (!mounted) return
      setSession(session)
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // console.log('[AUTH EVENT]', event)
        // console.log('[AUTH SESSION]', session)
        if (!mounted) return

        setSession(session)

        if (event === 'SIGNED_IN' && session?.user) {
          // console.log('[AUTH] User signed in:', session.user.id)
          // Show migrate modal if guest data exists
          const local = getGuestSnippets()
          // console.log('[AUTH] Guest snippets found:', local.length)
          if (local.length > 0) {
            setMigrateModal(true)
          }
        }

        if (
          session?.user &&
          session.provider_token &&
          session.provider_token !== lastToken.current
        ) {
          lastToken.current = session.provider_token

          // console.log('[AUTH] Provider token detected (new)')

          try {
            const encrypted = await encryptToken(session.provider_token)

            // console.log('[AUTH] Token encrypted, saving...')

            await supabase.from('user_tokens').upsert({
              user_id: session.user.id,
              github_token: encrypted,
              updated_at: new Date().toISOString(),
            })

            // console.log('[AUTH] Token saved successfully')
          } catch (err) {
            // console.error('[AUTH] Token save failed:', err)
            showToast('Failed to store GitHub token')
          }
        }

        if (event === 'SIGNED_OUT') {
          // console.log('[AUTH] User signed out')
          setSession(null)
        }

        setLoading(false)
      }
    )

    return () => {
      // console.log('[AUTH] cleanup')
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Offline/online detection since it is pretty bad to make changes and discover you were offline ;-;
  useEffect(() => {
    function handleOffline() {
      showToast('You appear to be offline - changes may not save')
    }
    function handleOnline() {
      showToast('Back online!')
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  // Handle keybinds
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement

      if (e.key === 'Enter' && active?.classList.contains(styles.titleInput)) {
        e.preventDefault()
        const editor = document.querySelector<HTMLElement>('.cm-content')
        editor?.focus()
        return
      }

      const isTyping =
        ['INPUT', 'TEXTAREA'].includes(active?.tagName) ||
        active?.classList.contains('cm-content')

      // Allow normal typing
      if (isTyping && !(e.metaKey || e.ctrlKey)) return

      // CMD/CTRL + S
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (currentId) saveSnippet(currentId, { title, code, lang, tags })
        return
      }

      // CMD/CTRL + N
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        newSnippet()
        return
      }

      // Brew mode toggle
      if (e.key === 'b' && !e.metaKey && !e.ctrlKey && currentId) {
        e.preventDefault()
        setBrewOpen(v => !v)
        return
      }

      if (e.key === 'Escape') {
        if (brewOpen) {
          setBrewOpen(false)
        } else {
          setCurrentId(null)
          setTitle('')
          setCode('')
          setLang('js')
          setTags([])
        }
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

  // Timer cleanup in case component unmounts
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  // Load snippets
  const loadSnippets = useCallback(async () => {
    if (!session?.user?.id) {
      setSnippets(getGuestSnippets())
      return
    }

    let attempts = 0

    while (attempts < 3) {
      try {
        const { data, error } = await supabase
          .from('snippets')
          .select('*')
          .eq('user_id', session.user.id)
          .order('updated_at', { ascending: false })

        if (error) throw error

        if (data) {
          setSnippets(data)
          return
        }
      } catch (e) {
        attempts++
        if (attempts >= 3) {
          showToast('Failed to load snippets')
          return
        }
        await new Promise(res => setTimeout(res, 1000))
      }
    }
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
    const saveId = ++lastSaveId.current
    setSaving(true)

    const slowTimer = setTimeout(() => {
      showToast('Saving is taking longer than usual...')
    }, 3000)

    try {
      const updatedAt = new Date().toISOString()

      if (!session?.user?.id) {
        const updated = snippets.map(s =>
          s.id === id ? { ...s, ...patch, updated_at: updatedAt } : s
        )

        if (saveId !== lastSaveId.current) return

        saveGuestSnippets(updated)
        setSnippets(updated)
        return
      }

      const { error } = await supabase
        .from('snippets')
        .update({
          ...patch,
          updated_at: updatedAt,
        })
        .eq('id', id)

      if (error) throw error

      if (saveId !== lastSaveId.current) return

      // Optimistic UI update
      setSnippets(prev =>
        prev.map(s =>
          s.id === id ? { ...s, ...patch, updated_at: updatedAt } : s
        )
      )

    } catch (err) {
      console.error(err)
      if (saveId === lastSaveId.current) {
        showToast('Failed to save snippet')
      }
    } finally {
      clearTimeout(slowTimer)
      if (saveId === lastSaveId.current) {
        setSaving(false)
      }
    }
  }

  // Handle file import
  async function handleFileImport(file: File) {
    try {
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
      const title = file.name.replace(/\.[^.]+$/, '')

      if (!session?.user?.id) {
        const s = createGuestSnippet({ title, code, lang })

        const updated = [s, ...snippets]
        saveGuestSnippets(updated)
        setSnippets(updated)

        setCurrentId(s.id)
        setTitle(s.title)
        setCode(s.code)
        setLang(s.lang)
        setTags([])

        setMobileView('editor')

        showToast(`Imported ${file.name}`)
        return
      }

      const { data, error } = await supabase
        .from('snippets')
        .insert({
          user_id: session.user.id,
          title,
          code,
          lang,
          tags: [],
        })
        .select()
        .single()

      if (error) throw error
      if (!data) throw new Error('Insert failed')

      await loadSnippets()

      setCurrentId(data.id)
      setTitle(data.title)
      setCode(data.code)
      setLang(data.lang)
      setTags([])

      setMobileView('editor')

      showToast(`Imported ${file.name}`)
    } catch (err: any) {
      console.error(err)

      if (err.message?.includes('Snippet limit reached')) {
        showToast('Snippet limit reached (100 max)')
      } else {
        showToast('Failed to import file')
      }
    }
  }

  // Handle any change in the snippet (title, code, lang) with automatic save after a short delay
  function handleFieldChange(field: string, value: string) {
    if (field === 'title') setTitle(value)
    if (field === 'code') setCode(value)
    if (field === 'lang') setLang(value)

    if (!currentId) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      saveSnippet(currentId, { [field]: value })
    }, 800)
  }

  // New snippet
  async function newSnippet() {
    if (!session?.user?.id) {
      const s = createGuestSnippet({})
      const updated = [s, ...snippets]
      saveGuestSnippets(updated)
      setSnippets(updated)
      setCurrentId(s.id)
      setTitle(s.title)
      setCode(s.code)
      setLang(s.lang)
      setTags(s.tags)
      setTagInput('')
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(`.${styles.titleInput}`)
        if (input) { input.focus(); input.select() }
      }, 50)
      return
    }

    // const { data: { user } } = await supabase.auth.getUser()
    // if (!user?.id) return
    const userId = session?.user?.id
    if (!userId) return

    const { data, error } = await supabase.from('snippets').insert({
      user_id: userId,
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

    try {
      if (!session?.user?.id) {
        const updated = snippets.filter(s => s.id !== currentId)
        saveGuestSnippets(updated)
        setSnippets(updated)
        setCurrentId(null)
        setTitle('')
        setCode('')
        setLang('js')
        setTags([])
        showToast('Snippet deleted')
        return
      }

      const { error } = await supabase
        .from('snippets')
        .delete()
        .eq('id', currentId)

      if (error) throw error

      setCurrentId(null)
      setTitle('')
      setCode('')
      setLang('js')
      setTags([])

      await loadSnippets()

      showToast('Snippet deleted')
    } catch (err) {
      console.error(err)
      showToast('Failed to delete snippet')
    }
  }

  // Import from Gist
  async function handleImported(snippet: {
    title: string
    code: string
    lang: string
    gist_url: string
  }) {
    try {
      if (!session?.user?.id) {
        const s = createGuestSnippet({
          title: snippet.title,
          code: snippet.code,
          lang: snippet.lang,
          gist_url: snippet.gist_url,
        })

        const updated = [s, ...snippets]
        saveGuestSnippets(updated)
        setSnippets(updated)

        setCurrentId(s.id)
        setTitle(s.title)
        setCode(s.code)
        setLang(s.lang)
        setTags([])

        showToast('Gist imported')
        return
      }

      if (importingGist) return

      setImportingGist(true)

      const { data, error } = await supabase
        .from('snippets')
        .insert({
          user_id: session.user.id,
          title: snippet.title,
          code: snippet.code,
          lang: snippet.lang,
          tags: [],
          gist_url: snippet.gist_url,
        })
        .select()
        .single()

      if (error) throw error
      if (!data) throw new Error('Insert failed')

      await loadSnippets()

      setCurrentId(data.id)
      setTitle(data.title)
      setCode(data.code)
      setLang(data.lang)
      setTags([])

      showToast('Gist imported')
    } catch (err: any) {
      console.error(err)

      if (err.message?.includes('Snippet limit reached')) {
        showToast('Snippet limit reached (100 max)')
      } else {
        showToast('Failed to import Gist')
      }
    } finally {
      setImportingGist(false)
    }
  }

  // Migrate guest snippets to user account on login
  async function migrateGuestSnippets() {
    if (!session?.user?.id) return

    try {
      const local = getGuestSnippets()

      const payload = local.map(s => ({
        user_id: session.user.id,
        title: s.title,
        code: s.code,
        lang: s.lang,
        tags: s.tags,
      }))

      const { error } = await supabase
        .from('snippets')
        .insert(payload)

      if (error) throw error

      clearGuestSnippets()

      showToast(`${local.length} snippet${local.length > 1 ? 's' : ''} migrated!`)
      await loadSnippets()
      setMigrateModal(false)

    } catch (err) {
      console.error(err)
      showToast('Migration failed, your local snippets are still safe')
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
    if (!currentId || pushingGist) return

    setPushingGist(true)
    showToast('Pushing to Gist...')

    try {
      const res = await fetch('/api/gist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, code, lang }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create Gist')
      }

      if (!data.url) {
        throw new Error('No URL returned from Gist')
      }

      await saveSnippet(currentId, { gist_url: data.url })

      showToast('Gist created, opening...')
      window.open(data.url, '_blank')
    } catch (err: any) {
      console.error(err)
      showToast(err.message || 'Failed to create Gist')
    } finally {
      setPushingGist(false)
    }
  }

  // Share snippet (sharing)
  async function shareSnippet() {
    if (!currentId || !session?.user?.id) return

    showToast('Creating share link...')

    try {
      const { data, error } = await supabase
        .from('shared_snippets')
        .insert({
          user_id: session.user.id,
          title,
          code,
          lang,
          tags,
        })
        .select()
        .single()

      if (error) throw error
      if (!data) throw new Error('No share data returned')

      const url = `${window.location.origin}/s/${data.id}`

      await navigator.clipboard.writeText(url)

      showToast('Share link copied (expires in 7 days)')
    } catch (err) {
      console.error(err)
      showToast('Failed to create share link')
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

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false)
      setTimeout(() => setToast(''), 300)
    }, 2000)
  }

  // Filter snippets based on search (in title and in code) and active tag
  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase()

    return snippets
      .filter(s => !activeTag || s.tags.includes(activeTag))
      .filter(s =>
        !searchLower ||
        s.title.toLowerCase().includes(searchLower) ||
        s.code.toLowerCase().includes(searchLower)
      )
  }, [snippets, activeTag, search])

  const currentSnippet = snippets.find(s => s.id === currentId)

  // Auth guards
  if (loading) {
    return (
      <div className={styles.loading}>
        brewing...
      </div>
    )
  } 
  if (!session && !isGuest) {
    return <LoginScreen />
  }

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
        isGuest={isGuest}
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
        onMigrateGuest={() => setMigrateModal(true)}
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
                {session && (
                  <button className={styles.btnAction} onClick={shareSnippet}>
                    <IconShare /> Share
                  </button>
                )}
                {session && (
                  <button
                    className={styles.btnActionPrimary}
                    onClick={pushToGist}
                    disabled={pushingGist}
                    style={{ opacity: pushingGist ? 0.6 : 1 }}
                  >
                    <IconGist /> {pushingGist ? 'Pushing...' : 'Push to Gist'}
                  </button>
                )}
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

      {migrateModal && (
        <MigrateModal
          count={getGuestSnippets().length}
          onMigrate={migrateGuestSnippets}
          onDiscard={() => {
            setMigrateModal(false)
            clearGuestSnippets()
          }}
        />
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