import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.provider_token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, code, lang } = await req.json()

  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.provider_token}`,
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