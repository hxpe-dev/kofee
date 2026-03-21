export interface Snippet {
  id: string
  user_id: string
  title: string
  code: string
  lang: string
  tags: string[]
  gist_url: string | null
  created_at: string
  updated_at: string
}