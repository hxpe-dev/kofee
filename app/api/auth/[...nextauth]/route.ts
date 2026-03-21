import NextAuth from 'next-auth'
import GithubProvider from 'next-auth/providers/github'

const handler = NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user gist', // gist scope = can create Gists
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Store GitHub access token on first login
      if (account) {
        token.githubAccessToken = account.access_token ?? ''
      }
      return token
    },
    async session({ session, token }) {
      // Expose it in the session so the app can use it
      session.githubAccessToken = token.githubAccessToken as string
      session.user.id = token.sub!
      return session
    },
  },
})

export { handler as GET, handler as POST }