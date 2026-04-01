export async function getUserFromRequest(req: Request, supabase: any) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.split(' ')[1]

  const { data, error } = await supabase.auth.getUser(token)

  if (error) return null

  return data.user ?? null
}