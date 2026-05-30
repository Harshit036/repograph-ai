import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, profile }) {
      // Persist GitHub numeric ID and avatar into the JWT
      if (profile) {
        token.githubId    = String(profile.id)
        token.githubLogin = profile.login as string
        token.avatarUrl   = profile.avatar_url as string
      }
      return token
    },
    session({ session, token }) {
      session.user.id          = token.githubId as string
      session.user.githubLogin = token.githubLogin as string
      session.user.avatarUrl   = token.avatarUrl as string
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
