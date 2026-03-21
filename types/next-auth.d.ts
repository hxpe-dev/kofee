import 'next-auth'

declare module 'next-auth' {
  interface Session {
    githubAccessToken: string
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    githubAccessToken: string
  }
}