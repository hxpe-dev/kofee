'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Snippet } from '@/types/snippet'
import LoginScreen from '@/components/LoginScreen'
import Sidebar from '@/components/Sidebar'
import type { Session } from '@supabase/supabase-js'
import CodeEditor from '@/components/CodeEditor'

const LANGS = ['js','ts','py','css','bash','sql','html','json','other']

export default function Home() {
  const [session, setSession]     = useState<Session | null>(null)
  const [loading, setLoading]     = useState(true)
  const [snippets, setSnippets]   = useState<Snippet[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [title, setTitle]         = useState('')
  const [code, setCode]           = useState('')
  const [lang, setLang]           = useState('js')
  const [tags, setTags]           = useState<string[]>([])
  const [tagInput, setTagInput]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState('')
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // ── Auth listener ──────────────────────────────────────────────
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

  // ── Auto save ──────────────────────────────────────────────────
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
        const input = document.querySelector<HTMLInputElement>('input[placeholder="Snippet title..."]')
        if (input) { input.focus(); input.select() }
      }, 50)
    }
  }

  // ── Delete snippet ─────────────────────────────────────────────
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

  // ── Copy ───────────────────────────────────────────────────────
  function copyCode() {
    navigator.clipboard.writeText(code)
    showToast('Copied to clipboard ✓')
  }

  // ── Toast ──────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // ── Filter ─────────────────────────────────────────────────────
  const filtered = snippets
    .filter(s => !activeTag || s.tags.includes(activeTag))
    .filter(s => !search
      || s.title.toLowerCase().includes(search.toLowerCase())
      || s.code.toLowerCase().includes(search.toLowerCase())
    )

  // ── Auth guard ─────────────────────────────────────────────────
  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)',
      color: 'var(--text-faint)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
    }}>
      brewing...
    </div>
  )

  if (!session) return <LoginScreen />

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Sidebar
        snippets={filtered}
        currentId={currentId}
        onSelect={selectSnippet}
        onNew={newSnippet}
        search={search}
        onSearch={setSearch}
        activeTag={activeTag}
        onTagClick={t => setActiveTag(activeTag === t ? null : t)}
        onImported={handleImported}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!currentId ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-faint)', gap: '12px',
          }}>
            <div style={{ fontSize: '36px', opacity: 0.3 }}>☕</div>
            <div style={{ fontFamily: 'var(--font-lora), serif', fontSize: '15px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
              Nothing brewing yet
            </div>
            <div style={{ fontSize: '11px', textAlign: 'center', maxWidth: '220px', lineHeight: 1.7 }}>
              Select a snippet or create a new one
            </div>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 28px', borderBottom: '1px solid var(--border)', gap: '12px' }}>
              <input
                value={title}
                onChange={e => handleFieldChange('title', e.target.value)}
                placeholder="Snippet title..."
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: 'var(--font-lora), serif', fontSize: '20px',
                  fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.2px',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                {([
                  { label: 'Copy',         onClick: copyCode,      primary: false },
                  { label: 'Push to Gist', onClick: pushToGist,    primary: true  },
                  { label: 'Delete',       onClick: deleteSnippet, primary: false },
                ] as const).map(btn => (
                  <button key={btn.label} onClick={btn.onClick} style={{
                    background:   btn.primary ? 'rgba(200,150,90,0.15)' : 'var(--surface)',
                    border:       `1px solid ${btn.primary ? 'rgba(200,150,90,0.3)' : 'var(--border2)'}`,
                    borderRadius: '7px', padding: '6px 14px',
                    color:        btn.primary ? 'var(--accent)' : 'var(--text-dim)',
                    fontFamily:   'JetBrains Mono, monospace', fontSize: '11px',
                    cursor:       'pointer',
                  }}>
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Meta bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 28px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <select
                value={lang}
                onChange={e => handleFieldChange('lang', e.target.value)}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border2)',
                  borderRadius: '6px', padding: '4px 10px', color: 'var(--text-dim)',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', outline: 'none',
                }}
              >
                {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>

              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={addTag}
                placeholder="Add tag, press Enter..."
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border2)',
                  borderRadius: '6px', padding: '4px 10px', color: 'var(--text-dim)',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
                  outline: 'none', width: '160px',
                }}
              />

              {tags.map(tag => (
                <span
                  key={tag}
                  onClick={() => removeTag(tag)}
                  style={{
                    background: 'rgba(200,150,90,0.12)', border: '1px solid var(--border2)',
                    borderRadius: '5px', padding: '2px 8px', fontSize: '10px',
                    color: 'var(--accent)', cursor: 'pointer',
                  }}
                >
                  {tag} ×
                </span>
              ))}

              {snippets.find(s => s.id === currentId)?.gist_url && (
                <a
                  href={snippets.find(s => s.id === currentId)!.gist_url!}
                  target="_blank" rel="noreferrer"
                  style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-faint)', textDecoration: 'none' }}
                >
                  ↗ view gist
                </a>
              )}
            </div>

            {/* Code area */}
            <CodeEditor
              value={code}
              lang={lang}
              onChange={value => handleFieldChange('code', value)}
            />

            {/* Status bar */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 28px', borderTop: '1px solid var(--border)', gap: '16px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
                Lines: <span style={{ color: 'var(--text-dim)' }}>{code.split('\n').length}</span>
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
                Chars: <span style={{ color: 'var(--text-dim)' }}>{code.length}</span>
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-faint)', marginLeft: 'auto' }}>
                {saving ? 'saving...' : '✓ saved'}
              </span>
            </div>
          </>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '30px', left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface2)', border: '1px solid var(--border2)',
          borderRadius: '10px', padding: '10px 20px',
          fontSize: '11px', color: 'var(--text)',
          fontFamily: 'JetBrains Mono, monospace',
          zIndex: 100, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}