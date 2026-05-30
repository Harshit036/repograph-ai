'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Settings, GitBranch, LogOut, ChevronDown } from 'lucide-react'
import LeftPanel from '@/components/workspace/LeftPanel'
import CenterPanel from '@/components/workspace/CenterPanel'
import RightPanel from '@/components/workspace/RightPanel'
import LLMSettingsModal from '@/components/LLMSettingsModal'
import { useWorkspace } from '@/store/workspace'

export default function WorkspacePage() {
  const [showSettings, setShowSettings] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { data: session } = useSession()
  const { llmConfig, setUser } = useWorkspace()

  // Sync NextAuth session → Zustand store so API calls include X-User-Id
  useEffect(() => {
    if (session?.user?.id) {
      setUser(
        session.user.id,
        (session.user as { githubLogin?: string }).githubLogin ?? session.user.name ?? '',
        (session.user as { avatarUrl?: string }).avatarUrl ?? session.user.image ?? '',
      )
    }
  }, [session, setUser])

  const avatarUrl = (session?.user as { avatarUrl?: string })?.avatarUrl ?? session?.user?.image
  const userName  = (session?.user as { githubLogin?: string })?.githubLogin ?? session?.user?.name ?? ''

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-accent" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">RepoGraph AI</span>
          <span className="text-[10px] text-muted border border-border rounded-full px-2 py-0.5 ml-1">beta</span>
        </div>

        <div className="flex items-center gap-3">
          {/* LLM settings badge */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 bg-s2 hover:bg-border border border-border rounded-lg px-3 py-1.5 transition-colors group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-xs text-zinc-300 font-mono">
              {llmConfig.provider}/{llmConfig.model.split('-').slice(0, 2).join('-')}
            </span>
            <Settings className="w-3.5 h-3.5 text-muted group-hover:text-white transition-colors" />
          </button>

          {/* User avatar + dropdown */}
          {session?.user && (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2 bg-s2 hover:bg-border border border-border rounded-lg px-2.5 py-1.5 transition-colors"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} className="w-5 h-5 rounded-full" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-accent/30 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-accent">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-xs text-zinc-300 max-w-[100px] truncate">{userName}</span>
                <ChevronDown className="w-3 h-3 text-muted" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-20 bg-surface border border-border rounded-xl shadow-xl overflow-hidden w-44">
                    <button
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-danger hover:bg-danger/10 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Three-panel body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <LeftPanel />
        <CenterPanel />
        <RightPanel />
      </div>

      {showSettings && <LLMSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
