'use client'
import { signIn } from 'next-auth/react'
import { GitBranch, Github } from 'lucide-react'

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
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Sign in</h2>
            <p className="text-xs text-muted mt-1">
              Connect with GitHub to analyze your repositories.
            </p>
          </div>

          <button
            onClick={() => signIn('github', { callbackUrl: '/workspace' })}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-medium px-4 py-2.5 rounded-lg text-sm transition-colors"
          >
            <Github className="w-4 h-4" />
            Continue with GitHub
          </button>

          <p className="text-[11px] text-muted text-center leading-relaxed">
            Only your GitHub profile info (name, avatar, ID) is stored.
            Repository data is isolated to your account.
          </p>
        </div>
      </div>
    </div>
  )
}
