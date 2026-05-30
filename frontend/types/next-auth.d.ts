import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      githubLogin: string
      avatarUrl: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    githubLogin: string
    avatarUrl: string
  }
}
