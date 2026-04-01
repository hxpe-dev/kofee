import { useState, useCallback, useRef, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Snippet } from '@/types/snippet'
import {
  getGuestSnippets,
  saveGuestSnippets,
  clearGuestSnippets,
  createGuestSnippet,
} from '@/lib/guestSnippets'

interface UseSnippetsOptions {
  session: Session | null
  showToast: (msg: string) => void
  setMobileView: (v: 'sidebar' | 'editor') => void
  setMigrateModal: (v: boolean) => void
}

export function useSnippets({
  session,
  showToast,
  setMobileView,
  setMigrateModal,
}: UseSnippetsOptions) {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [lang, setLang] = useState('js')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [pushingGist, setPushingGist] = useState(false)
  const [importingGist, setImportingGist] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const lastSaveId = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      } catch {
        attempts++
        if (attempts >= 3) {
          showToast('Failed to load snippets')
          return
        }
        await new Promise(res => setTimeout(res, 1000))
      }
    }
  }, [session?.user?.id])

  function selectSnippet(id: string, isMobile: boolean) {
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

  function clearCurrent() {
    setCurrentId(null)
    setTitle('')
    setCode('')
    setLang('js')
    setTags([])
  }

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
        .update({ ...patch, updated_at: updatedAt })
        .eq('id', id)

      if (error) throw error
      if (saveId !== lastSaveId.current) return

      setSnippets(prev =>
        prev.map(s => s.id === id ? { ...s, ...patch, updated_at: updatedAt } : s)
      )
    } catch (err) {
      console.error(err)
      if (saveId === lastSaveId.current) showToast('Failed to save snippet')
    } finally {
      clearTimeout(slowTimer)
      if (saveId === lastSaveId.current) setSaving(false)
    }
  }

  function handleFieldChange(field: string, value: string) {
    if (field === 'title') setTitle(value)
    if (field === 'code') setCode(value)
    if (field === 'lang') setLang(value)

    if (!currentId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveSnippet(currentId, { [field]: value })
    }, 800)
  }

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
        const input = document.querySelector<HTMLInputElement>('[data-title-input]')
        if (input) {
          input.focus()
          input.select()
        }
      }, 50)
      return
    }

    const userId = session.user.id
    const { data, error } = await supabase.from('snippets').insert({
      user_id: userId,
      title: 'Untitled snippet',
      code: '',
      lang: 'js',
      tags: [],
    }).select().single()

    if (error) {
      showToast(error.message.includes('Snippet limit reached')
        ? 'Snippet limit reached (100 max)'
        : 'Failed to create snippet')
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
        const input = document.querySelector<HTMLInputElement>('[data-title-input]')
        if (input) {
          input.focus()
          input.select()
        }
      }, 50)
    }
  }

  async function deleteSnippet() {
    if (!currentId) return
    try {
      if (!session?.user?.id) {
        const updated = snippets.filter(s => s.id !== currentId)
        saveGuestSnippets(updated)
        setSnippets(updated)
        clearCurrent()
        showToast('Snippet deleted')
        return
      }

      const { error } = await supabase.from('snippets').delete().eq('id', currentId)
      if (error) throw error
      clearCurrent()
      await loadSnippets()
      showToast('Snippet deleted')
    } catch (err) {
      console.error(err)
      showToast('Failed to delete snippet')
    }
  }

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

      const { data, error } = await supabase.from('snippets')
        .insert({ user_id: session.user.id, title, code, lang, tags: [] })
        .select().single()

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
      showToast(err.message?.includes('Snippet limit reached')
        ? 'Snippet limit reached (100 max)'
        : 'Failed to import file')
    }
  }

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

      const { data, error } = await supabase.from('snippets')
        .insert({
          user_id: session.user.id,
          title: snippet.title,
          code: snippet.code,
          lang: snippet.lang,
          tags: [],
          gist_url: snippet.gist_url,
        })
        .select().single()

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
      showToast(err.message?.includes('Snippet limit reached')
        ? 'Snippet limit reached (100 max)'
        : 'Failed to import Gist')
    } finally {
      setImportingGist(false)
    }
  }

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
      const { error } = await supabase.from('snippets').insert(payload)
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

  async function pushToGist() {
    if (!currentId || pushingGist) return
    setPushingGist(true)
    showToast('Pushing to Gist...')
    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/gist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ title, code, lang }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to create Gist')
      if (!data.url) throw new Error('No URL returned from Gist')

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

  async function shareSnippet(sessionUserId: string) {
    if (!currentId) return
    showToast('Creating share link...')
    try {
      const { data, error } = await supabase.from('shared_snippets')
        .insert({ user_id: sessionUserId, title, code, lang, tags })
        .select().single()

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return {
    snippets, currentId, title, code, lang, tags, tagInput, saving,
    pushingGist, importingGist, confirmDelete,
    setTagInput, setConfirmDelete, clearCurrent,
    loadSnippets, selectSnippet, saveSnippet, handleFieldChange,
    newSnippet, deleteSnippet, handleFileImport, handleImported,
    migrateGuestSnippets, addTag, removeTag, pushToGist, shareSnippet,
  }
}