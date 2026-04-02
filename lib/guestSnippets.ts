import { Snippet } from '@/types/snippet'

const KEY = 'kofee_guest_snippets'

export function getGuestSnippets(): Snippet[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveGuestSnippets(snippets: Snippet[]): void {
  localStorage.setItem(KEY, JSON.stringify(snippets))
}

export function clearGuestSnippets(): void {
  localStorage.removeItem(KEY)
}

export function createGuestSnippet(patch: Partial<Snippet>): Snippet {
  return {
    id: crypto.randomUUID(),
    user_id: 'guest',
    title: patch.title ?? 'Untitled snippet',
    code: patch.code ?? '',
    lang: patch.lang ?? 'js',
    tags: patch.tags ?? [],
    gist_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...patch,
  }
}