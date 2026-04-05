export async function getUserFromRequest(req: Request, supabase: any) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.split(' ')[1]

  const { data, error } = await supabase.auth.getUser(token)

  if (error) return null

  return data.user ?? null
}

/**
 * Returns a human-readable "time ago" string.
 * e.g. "just now", "4m ago", "2h ago", "3d ago"
 */
export function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/**
 * Returns a human-readable "time until" string.
 * e.g. "6d left", "3h left", "12m left"
 */
export function timeUntil(ts: string): string {
  const diff = new Date(ts).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m left`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

/**
 * Returns true if the given timestamp expires within 24 hours.
 */
export function expiresSoon(ts: string): boolean {
  return new Date(ts).getTime() - Date.now() < 1000 * 60 * 60 * 24
}