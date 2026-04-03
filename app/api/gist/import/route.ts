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

  const { gistUrl } = await req.json()

  // Extract gist ID: supports https://gist.github.com/username/GIST_ID
  const match = gistUrl.match(/gist\.github\.com\/[^/]+\/([a-f0-9]+)/i)
  if (!match) {
    return NextResponse.json({ error: 'Invalid Gist URL' }, { status: 400 })
  }

  const gistId = match[1]
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Gist not found or not accessible' }, { status: 404 })
  }

  const gist = await res.json()
  const files = Object.values(gist.files) as any[]

  if (files.length === 0) {
    return NextResponse.json({ error: 'Gist has no files' }, { status: 400 })
  }

  const parsed = files.map((file: any) => ({
    filename: file.filename,
    content:  file.content,
    language: detectLang(file.filename, file.language),
  }))

  return NextResponse.json({
    title:    gist.description || parsed[0].filename || 'Imported Gist',
    files:    parsed,
    gist_url: gistUrl,
  })
}

function detectLang(filename: string, githubLang: string | null): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const extMap: Record<string, string> = {
    js: 'js',
    jsx: 'js',
    mjs: 'js',
    cjs: 'js',
    ts: 'ts',
    tsx: 'ts',
    py: 'py',
    rs: 'rs',
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
  if (extMap[ext]) return extMap[ext]

  const langMap: Record<string, string> = {
    JavaScript: 'js',
    TypeScript: 'ts',
    Python: 'py',
    Rust: 'rs',
    CSS: 'css',
    HTML: 'html',
    JSON: 'json',
    Shell: 'bash',
    Bash: 'bash',
    SQL: 'sql',
  }
  return langMap[githubLang ?? ''] ?? 'other'
}