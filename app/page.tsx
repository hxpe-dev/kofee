'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import LoginScreen from '@/components/LoginScreen'
import Sidebar from '@/components/Sidebar'
import CodeEditor from '@/components/CodeEditor'
import styles from '@/styles/page.module.css'
import { strToU8, zip } from 'fflate'
import type { AsyncZippable, GzipOptions } from 'fflate'
import { IconExpand, IconDownload, IconCopy, IconTrash, IconGist, IconShare } from '@/components/icons'
import { getGuestSnippets } from '@/lib/guestSnippets'
import MigrateModal from '@/components/MigrateModal'
import { useToast } from '@/hooks/useToast'
import { useMobileDetect } from '@/hooks/useMobileDetect'
import { useAuth } from '@/hooks/useAuth'
import { useSnippets } from '@/hooks/useSnippets'

const LANGS = ['js','ts','py','rust','css','bash','sql','html','json','other']

const EXTENSIONS: Record<string, string> = {
  js: 'js',
  ts: 'ts',
  py: 'py',
  rs: 'rs',
  css: 'css',
  bash: 'sh',
  sql: 'sql',
  html: 'html',
  json: 'json',
  other: 'txt'
}

export default function Home() {
  const { toast, toastVisible, showToast } = useToast()
  const { isMobile, mobileView, setMobileView } = useMobileDetect()
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [brewOpen, setBrewOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [dragging, setDragging] = useState(false)

  const { session, loading, isGuest, migrateModal, setMigrateModal } = useAuth({
    onSignIn: () => {},
    showToast,
  })

  const {
    snippets, currentId, title, code, lang, tags, tagInput, saving,
    pushingGist, importingGist, confirmDelete,
    setTagInput, setConfirmDelete, clearCurrent,
    loadSnippets, selectSnippet, saveSnippet, handleFieldChange,
    newSnippet, deleteSnippet, handleFileImport, handleImported,
    migrateGuestSnippets, addTag, removeTag, pushToGist, shareSnippet,
  } = useSnippets({ session, showToast, setMobileView, setMigrateModal })

  const keybindRef = useRef({ currentId, brewOpen, title, code, lang, tags, saveSnippet, newSnippet, clearCurrent })
  useEffect(() => {
    keybindRef.current = { currentId, brewOpen, title, code, lang, tags, saveSnippet, newSnippet, clearCurrent }
  })

  useEffect(() => { loadSnippets() }, [loadSnippets])

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
      const { currentId, brewOpen, title, code, lang, tags, saveSnippet, newSnippet, clearCurrent } = keybindRef.current

      const active = document.activeElement as HTMLElement

      if (e.key === 'Enter' && active?.classList.contains(styles.titleInput)) {
        e.preventDefault()
        document.querySelector<HTMLElement>('.cm-content')?.focus()
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
          clearCurrent()
        }
      }
    }

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
      if (err) {
        showToast('Export failed')
        return
      }
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
      onDragOver={e => {
        e.preventDefault()
        setDragging(true)
      }}
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
        onSelect={id => selectSnippet(id, isMobile)}
        onNew={newSnippet}
        onImported={handleImported}
        search={search}
        onSearch={setSearch}
        activeTag={activeTag}
        onTagClick={t => setActiveTag(activeTag === t ? null : t)}
        onLogoClick={() => {
          clearCurrent()
          setMobileView('sidebar')
        }}
        onDownloadAll={downloadAllSnippets}
        onImportFile={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.js,.jsx,.ts,.tsx,.py,.rs,.css,.scss,.html,.json,.sh,.bash,.sql,.txt,.md,.other'
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
                data-title-input
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
                  <button className={styles.btnAction} onClick={() => shareSnippet(session.user.id)}>
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