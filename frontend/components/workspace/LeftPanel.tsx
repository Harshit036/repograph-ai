'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Github, Upload, CheckCircle, AlertCircle, FileCode2,
  Layers, Loader2, Clock, RefreshCw,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useWorkspace } from '@/store/workspace'

export default function LeftPanel() {
  const {
    currentRepo, ingestionStatus, ingestionError,
    repoHistory, setCurrentRepo, setIngestionStatus, setRepoHistory,
  } = useWorkspace()
  const { data: session } = useSession()
  const [url, setUrl] = useState('')

  // Load repo history on mount; auto-restore most recent repo so chat is ready immediately
  useEffect(() => {
    if (!session?.user?.id) return
    api.myRepos()
      .then(repos => {
        setRepoHistory(repos)
        if (!currentRepo && repos.length > 0) {
          const latest = repos[0]
          setCurrentRepo({ url: latest.repo_url, totalFiles: latest.file_count, files: [] })
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  const handleIngest = async (repoUrl?: string) => {
    const trimmed = (repoUrl ?? url).trim()
    if (!trimmed) return
    if (!repoUrl) setUrl(trimmed)
    setIngestionStatus('loading')
    try {
      const githubLogin = (session?.user as { githubLogin?: string })?.githubLogin ?? ''
      const avatarUrl   = (session?.user as { avatarUrl?: string })?.avatarUrl ?? session?.user?.image ?? ''
      const data = await api.ingest(trimmed, githubLogin, avatarUrl)

      if (data.skipped) {
        setIngestionStatus('skipped')
        // Restore the existing repo info from history
        const hist = repoHistory.find(r => r.repo_url === trimmed)
        if (hist) {
          setCurrentRepo({ url: trimmed, totalFiles: hist.file_count, files: [] })
        }
      } else {
        setCurrentRepo({ url: trimmed, totalFiles: data.total_files, files: data.files })
        setIngestionStatus('done')
        // Refresh history
        api.myRepos().then(setRepoHistory).catch(() => {})
      }
    } catch (e: unknown) {
      setIngestionStatus('error', e instanceof Error ? e.message : 'Ingestion failed')
    }
  }

  return (
    <aside className="h-full flex flex-col border-r border-border bg-surface overflow-y-auto">
      {/* URL input */}
      <div className="p-4 border-b border-border space-y-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Repository</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-s2 border border-border rounded-lg px-3 py-2">
            <Github className="w-3.5 h-3.5 text-muted flex-shrink-0" />
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ingestionStatus !== 'loading' && handleIngest()}
              placeholder="github.com/user/repo"
              className="flex-1 bg-transparent text-white placeholder-muted text-xs focus:outline-none font-mono min-w-0"
            />
          </div>
          <button
            onClick={() => handleIngest()}
            disabled={ingestionStatus === 'loading' || !url.trim()}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            {ingestionStatus === 'loading'
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…</>
              : <><Upload className="w-3.5 h-3.5" /> Analyze</>
            }
          </button>
        </div>

        {/* Status messages */}
        {ingestionStatus === 'error' && ingestionError && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg p-2.5">
            <AlertCircle className="w-3.5 h-3.5 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-xs text-danger leading-relaxed">{ingestionError}</p>
          </div>
        )}
        {ingestionStatus === 'skipped' && (
          <div className="flex items-start gap-2 bg-success/10 border border-success/30 rounded-lg p-2.5">
            <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
            <p className="text-xs text-success leading-relaxed">Up to date — no new commits since last ingest.</p>
          </div>
        )}
      </div>

      {/* Active repo stats */}
      {currentRepo && (
        <div className="p-4 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-success" />
            <p className="text-xs font-semibold text-success">Active</p>
          </div>
          <p className="text-xs text-muted font-mono truncate">{currentRepo.url.replace('https://', '')}</p>
          <div className="grid grid-cols-2 gap-2">
            <StatPill icon={FileCode2} label="Files"  value={currentRepo.totalFiles} color="text-blue-400" />
            <StatPill icon={Layers}    label="Chunks" value={currentRepo.files.reduce((a, f) => a + f.total_chunks, 0)} color="text-emerald-400" />
          </div>
          {currentRepo.files.length > 0 && (
            <div className="space-y-0.5 max-h-40 overflow-y-auto mt-1">
              {currentRepo.files.slice(0, 30).map((f, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                  <FileCode2 className="w-3 h-3 text-muted flex-shrink-0" />
                  <span className="text-[11px] text-zinc-400 font-mono truncate flex-1">{f.file_name}</span>
                  <span className="text-[10px] text-muted bg-s2 px-1.5 py-0.5 rounded-full flex-shrink-0">{f.total_chunks}</span>
                </div>
              ))}
              {currentRepo.files.length > 30 && (
                <p className="text-[11px] text-muted text-center pt-1">+{currentRepo.files.length - 30} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Repo history */}
      {repoHistory.length > 0 && (
        <div className="p-4 space-y-2 flex-1">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">History</p>
          {repoHistory.map((r) => {
            const isActive = currentRepo?.url === r.repo_url
            const name = r.repo_url.split('/').slice(-2).join('/')
            return (
              <button
                key={r.repo_id}
                onClick={() => handleIngest(r.repo_url)}
                disabled={ingestionStatus === 'loading'}
                className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all group ${
                  isActive
                    ? 'border-accent/40 bg-accent/5'
                    : 'border-border hover:border-muted bg-s2/50'
                }`}
              >
                <Github className="w-3.5 h-3.5 text-muted flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-zinc-300 truncate">{name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <FileCode2 className="w-2.5 h-2.5 text-muted" />
                    <span className="text-[10px] text-muted">{r.file_count} files</span>
                  </div>
                </div>
                <RefreshCw className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
              </button>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!currentRepo && ingestionStatus !== 'loading' && repoHistory.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-3">
            <Github className="w-5 h-5 text-accent" />
          </div>
          <p className="text-sm font-medium text-white">Paste a GitHub URL</p>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Enter a public GitHub repo URL above and click Analyze.
          </p>
        </div>
      )}

      <div className="mt-auto p-4 border-t border-border">
        <p className="text-[10px] text-muted text-center">RepoGraph AI · pgvector + LangGraph</p>
      </div>
    </aside>
  )
}

function StatPill({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string
}) {
  return (
    <div className="bg-s2 rounded-lg px-3 py-2 flex items-center gap-2">
      <Icon className={`w-3 h-3 ${color} flex-shrink-0`} />
      <div>
        <p className="text-xs font-bold text-white">{value}</p>
        <p className="text-[10px] text-muted">{label}</p>
      </div>
    </div>
  )
}
