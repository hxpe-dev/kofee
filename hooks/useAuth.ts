import { useState, useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { encryptToken } from '@/lib/crypto'
import { getGuestSnippets } from '@/lib/guestSnippets'

interface UseAuthOptions {
  onSignIn: () => void
  showToast: (msg: string) => void
}

export function useAuth({ onSignIn, showToast }: UseAuthOptions) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const [migrateModal, setMigrateModal] = useState(false)
  const lastToken = useRef<string | null>(null)

  useEffect(() => {
    setIsGuest(new URLSearchParams(window.location.search).get('guest') === 'true')
  }, [])

  useEffect(() => {
    let mounted = true

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(session)
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        setSession(session)

        if (event === 'SIGNED_IN' && session?.user) {
          const local = getGuestSnippets()
          if (local.length > 0) setMigrateModal(true)
          onSignIn()
        }

        if (
          session?.user &&
          session.provider_token &&
          session.provider_token !== lastToken.current
        ) {
          lastToken.current = session.provider_token
          try {
            const encrypted = await encryptToken(session.provider_token)
            await supabase.from('user_tokens').upsert({
              user_id: session.user.id,
              github_token: encrypted,
              updated_at: new Date().toISOString(),
            })
          } catch {
            showToast('Failed to store GitHub token')
          }
        }

        if (event === 'SIGNED_OUT') setSession(null)
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { session, loading, isGuest, migrateModal, setMigrateModal }
}