import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, account, profile }) {
      if (profile && account) {
        if (account.provider === 'github') {
          token.userId     = `gh_${String(profile.id)}`
          token.githubLogin = (profile as { login?: string }).login ?? token.email ?? ''
          token.avatarUrl   = (profile as { avatar_url?: string }).avatar_url ?? ''
        } else if (account.provider === 'google') {
          token.userId     = `go_${String(profile.sub ?? profile.id)}`
          token.githubLogin = profile.name ?? profile.email ?? ''
          token.avatarUrl   = (profile as { picture?: string }).picture ?? ''
        }
      }
      return token
    },
    session({ session, token }) {
      session.user.id          = token.userId as string ?? token.sub ?? ''
      session.user.githubLogin = token.githubLogin as string ?? session.user.name ?? ''
      session.user.avatarUrl   = token.avatarUrl as string ?? session.user.image ?? ''
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
