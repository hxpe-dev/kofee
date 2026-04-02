import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { decryptToken } from '@/lib/crypto'
import { ratelimit } from '@/lib/ratelimit'
import { getUserFromRequest } from '@/lib/utils'

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      global: {
        headers: {
          Authorization: req.headers.get('authorization') || '',
        },
      },
    }
  )

  const user = await getUserFromRequest(req, supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await ratelimit.limit(user.id)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests, slow down' }, { status: 429 })
  }

  const { data: tokenRow } = await supabase
    .from('user_tokens')
    .select('github_token')
    .eq('user_id', user.id)
    .single()

  if (!tokenRow?.github_token) {
    return NextResponse.json({ error: 'No GitHub token, please sign out and sign in again' }, { status: 401 })
  }

  const githubToken = await decryptToken(tokenRow.github_token)

  const { title, code, lang } = await req.json()

  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: title,
      public: false,
      files: { [`${title}.${lang}`]: { content: code } },
    }),
  })

  const gist = await res.json()
  return NextResponse.json({ url: gist.html_url })
}