import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await getServerSession()

  if (!session?.githubAccessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, code, lang } = await req.json()

  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.githubAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: title,
      public: false,
      files: {
        [`${title}.${lang}`]: { content: code },
      },
    }),
  })

  const gist = await res.json()
  return NextResponse.json({ url: gist.html_url })
}