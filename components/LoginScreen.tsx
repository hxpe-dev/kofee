'use client'

import { signIn } from 'next-auth/react'

export default function LoginScreen() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg)',
      gap: '32px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontFamily: 'var(--font-lora), serif',
          fontSize: '42px',
          color: 'var(--accent2)',
          fontWeight: 500,
          letterSpacing: '-0.5px',
          marginBottom: '8px',
        }}>
          Kofee
        </h1>
        <p style={{
          color: 'var(--text-faint)',
          fontSize: '13px',
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.05em',
        }}>
          your brew of code
        </p>
      </div>

      <button
        onClick={() => signIn('github')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          borderRadius: '10px',
          padding: '12px 24px',
          color: 'var(--text)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,150,90,0.4)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent2)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        Continue with GitHub
      </button>

      <p style={{ color: 'var(--text-faint)', fontSize: '11px', maxWidth: '280px', textAlign: 'center', lineHeight: 1.7 }}>
        We use GitHub to sync your snippets and enable one-click Gist publishing.
      </p>
    </div>
  )
}