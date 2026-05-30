'use client'
import { signIn } from 'next-auth/react'
import { GitBranch, Github } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto">
            <GitBranch className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">RepoGraph AI</h1>
            <p className="text-sm text-muted mt-1">Repository intelligence platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-3">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">Sign in</h2>
            <p className="text-xs text-muted mt-1">
              Choose how you&apos;d like to continue. Your data is isolated to your account.
            </p>
          </div>

          <button
            onClick={() => signIn('github', { callbackUrl: '/workspace' })}
            className="w-full flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 border border-border text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors"
          >
            <Github className="w-4 h-4" />
            Continue with GitHub
          </button>

          <button
            onClick={() => signIn('google', { callbackUrl: '/workspace' })}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-medium px-4 py-2.5 rounded-lg text-sm transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="pt-1">
            <p className="text-[11px] text-muted text-center leading-relaxed">
              Only your profile info (name, avatar) is stored. Repository data is scoped to your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
