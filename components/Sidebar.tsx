'use client'

import { Snippet } from '@/types/snippet'
import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'

interface Props {
  snippets: Snippet[]
  currentId: string | null
  onSelect: (id: string) => void
  onNew: () => void
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
  snippets, currentId, onSelect, onNew,
  search, onSearch, activeTag, onTagClick,
}: Props) {
  const { data: session } = useSession()

  const allTags = [...new Set(snippets.flatMap(s => s.tags))]

  return (
    <aside style={{
      width: '260px', minWidth: '260px',
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          fontFamily: 'var(--font-lora), serif',
          fontSize: '22px', fontWeight: 500,
          color: 'var(--accent2)', letterSpacing: '-0.3px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          Kofee
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '2px', letterSpacing: '0.05em' }}>
          {session?.user?.name}
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
                  borderRadius: '20px', padding: '3px 10px',
                  fontSize: '10px',
                  color: activeTag === tag ? 'var(--accent2)' : 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Snippet list */}
      <div style={{ fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text-faint)', textTransform: 'uppercase', padding: '8px 20px 4px' }}>
        Snippets
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
        {snippets.map(s => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              padding: '12px', borderRadius: '10px', cursor: 'pointer',
              background: s.id === currentId ? 'var(--surface)' : 'transparent',
              border: `1px solid ${s.id === currentId ? 'var(--border2)' : 'transparent'}`,
              marginBottom: '2px', transition: 'background 0.15s',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-lora), serif', fontSize: '13px',
              color: 'var(--text)', marginBottom: '4px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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
        ))}
      </div>

      {/* New + Sign out */}
      <div style={{ padding: '10px' }}>
        <button
          onClick={onNew}
          style={{
            width: '100%', background: 'var(--accent)', color: 'var(--bg)',
            border: 'none', borderRadius: '8px', padding: '9px 0',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
            fontWeight: 500, cursor: 'pointer', marginBottom: '6px',
            letterSpacing: '0.04em',
          }}
        >
          + New Snippet
        </button>
        <button
          onClick={() => signOut()}
          style={{
            width: '100%', background: 'transparent', color: 'var(--text-faint)',
            border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 0',
            fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
            cursor: 'pointer', letterSpacing: '0.04em',
          }}
        >
          sign out
        </button>
      </div>
    </aside>
  )
}