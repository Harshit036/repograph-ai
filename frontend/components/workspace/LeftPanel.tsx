'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Github, Upload, CheckCircle, AlertCircle, FileCode2,
  Layers, Loader2, GitPullRequest,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useWorkspace } from '@/store/workspace'

type LeftTab = 'repos' | 'pr'

export default function LeftPanel() {
  const {
    currentRepo, ingestionStatus, ingestionError,
    setCurrentRepo, setIngestionStatus,
    githubToken, setGithubToken,
    prDiff, prDiffLoading, setPrDiff,
  } = useWorkspace()

  const [tab, setTab] = useState<LeftTab>('repos')
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [prUrl, setPrUrl] = useState('')
  const { data: session } = useSession()
  const [url, setUrl] = useState('')

  const handleIngest = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setIngestionStatus('loading')
    try {
      const githubLogin = (session?.user as { githubLogin?: string })?.githubLogin ?? ''
      const avatarUrl   = (session?.user as { avatarUrl?: string })?.avatarUrl ?? session?.user?.image ?? ''
      const data = await api.ingest(trimmed, githubLogin, avatarUrl, githubToken)

      if (data.skipped) {
        setIngestionStatus('skipped')
        setCurrentRepo({
          url: trimmed, repoId: '', commitSha: data.commit_sha ?? '',
          totalFiles: data.total_files, totalChunks: 0, files: [],
        })
      } else {
        const totalChunks = data.files.reduce((a: number, f: { total_chunks: number }) => a + f.total_chunks, 0)
        setIngestionStatus('done')
        setCurrentRepo({
          url: trimmed, repoId: '', commitSha: data.commit_sha ?? '',
          totalFiles: data.total_files, totalChunks, files: data.files,
        })
      }
    } catch (e: unknown) {
      setIngestionStatus('error', e instanceof Error ? e.message : 'Ingestion failed')
    }
  }

  const loadPrDiff = async () => {
    if (!prUrl.trim()) return
    setPrDiff(null, true)
    try {
      const diff = await api.prDiff(prUrl.trim())
      setPrDiff(diff, false)
    } catch (e: unknown) {
      setPrDiff(null, false)
      alert(e instanceof Error ? e.message : 'Failed to load PR diff')
    }
  }

  const TABS: { id: LeftTab; icon: React.ElementType; label: string }[] = [
    { id: 'repos', icon: Github,         label: 'Repo' },
    { id: 'pr',    icon: GitPullRequest, label: 'PR' },
  ]

  return (
    <aside className="h-full flex flex-col border-r border-border bg-surface overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                active ? 'border-accent text-white' : 'border-transparent text-muted hover:text-zinc-300'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── REPO tab ──────────────────────────────────────────────────────── */}
        {tab === 'repos' && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-border space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Repository</p>
                <button onClick={() => setShowTokenInput(v => !v)}
                  className="text-[10px] text-muted hover:text-white border border-border rounded px-1.5 py-0.5">
                  {githubToken ? '🔑 Token set' : 'Private?'}
                </button>
              </div>

              {showTokenInput && (
                <div className="space-y-1.5">
                  <input
                    type="password"
                    value={githubToken}
                    onChange={e => setGithubToken(e.target.value)}
                    placeholder="GitHub personal access token"
                    className="w-full bg-s2 border border-border text-white placeholder-muted rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent font-mono"
                  />
                  <p className="text-[10px] text-muted">Required only for private repos. Stored locally.</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-s2 border border-border rounded-lg px-3 py-2">
                  <Github className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                  <input
                    type="text" value={url} onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && ingestionStatus !== 'loading' && handleIngest()}
                    placeholder="github.com/user/repo"
                    className="flex-1 bg-transparent text-white placeholder-muted text-xs focus:outline-none font-mono min-w-0"
                  />
                </div>
                <button
                  onClick={handleIngest}
                  disabled={ingestionStatus === 'loading' || !url.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                >
                  {ingestionStatus === 'loading'
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…</>
                    : <><Upload className="w-3.5 h-3.5" /> Analyze</>}
                </button>
              </div>

              {ingestionStatus === 'error' && ingestionError && (
                <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg p-2.5">
                  <AlertCircle className="w-3.5 h-3.5 text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-danger leading-relaxed">{ingestionError}</p>
                </div>
              )}
              {ingestionStatus === 'skipped' && (
                <div className="flex items-start gap-2 bg-success/10 border border-success/30 rounded-lg p-2.5">
                  <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-success leading-relaxed">Up to date — no new commits.</p>
                </div>
              )}
            </div>

            {/* Active repo stats */}
            {currentRepo ? (
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-success" />
                  <p className="text-xs font-semibold text-success">Active</p>
                </div>
                <p className="text-xs text-muted font-mono truncate">{currentRepo.url.replace('https://', '')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatPill icon={FileCode2} label="Files"  value={currentRepo.totalFiles}  color="text-blue-400" />
                  <StatPill icon={Layers}    label="Chunks" value={currentRepo.totalChunks ?? currentRepo.files.reduce((a, f) => a + f.total_chunks, 0)} color="text-emerald-400" />
                </div>
              </div>
            ) : (
              ingestionStatus !== 'loading' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                    <Github className="w-5 h-5 text-accent" />
                  </div>
                  <p className="text-sm font-medium text-white">Paste a GitHub URL</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">Enter a public or private GitHub repo URL above.</p>
                </div>
              )
            )}
          </div>
        )}

        {/* ── PR tab ────────────────────────────────────────────────────────── */}
        {tab === 'pr' && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-border space-y-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">PR Review</p>
              <div className="space-y-2">
                <input
                  type="text" value={prUrl} onChange={e => setPrUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadPrDiff()}
                  placeholder="github.com/owner/repo/pull/123"
                  className="w-full bg-s2 border border-border text-white placeholder-muted rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent font-mono"
                />
                <button onClick={loadPrDiff} disabled={prDiffLoading || !prUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
                  {prDiffLoading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</>
                    : <><GitPullRequest className="w-3.5 h-3.5" /> Load PR</>}
                </button>
              </div>
              <p className="text-[10px] text-muted leading-relaxed">
                Load a GitHub PR to browse changed files and ask the AI about the diff.
              </p>
            </div>

            {prDiff && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="bg-s2 border border-border rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-white">{prDiff.title}</p>
                  <p className="text-[11px] text-muted font-mono">{prDiff.repo} #{prDiff.number}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-success">+{prDiff.files.reduce((a, f) => a + f.additions, 0)}</span>
                    <span className="text-[10px] text-danger">-{prDiff.files.reduce((a, f) => a + f.deletions, 0)}</span>
                    <span className="text-[10px] text-muted">{prDiff.files.length} files</span>
                  </div>
                </div>
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Changed Files</p>
                {prDiff.files.map(f => (
                  <div key={f.filename} className="flex items-center gap-2 p-2 bg-s2/50 border border-border rounded-lg">
                    <span className={`text-[9px] px-1 py-0.5 rounded font-medium flex-shrink-0 ${
                      f.status === 'added' ? 'bg-success/20 text-success' :
                      f.status === 'removed' ? 'bg-danger/20 text-danger' :
                      'bg-warning/20 text-warning'
                    }`}>{f.status[0].toUpperCase()}</span>
                    <span className="text-[11px] font-mono text-zinc-300 truncate flex-1">{f.filename}</span>
                    <span className="text-[10px] text-success flex-shrink-0">+{f.additions}</span>
                    <span className="text-[10px] text-danger flex-shrink-0">-{f.deletions}</span>
                  </div>
                ))}
              </div>
            )}

            {!prDiff && !prDiffLoading && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <GitPullRequest className="w-8 h-8 text-muted opacity-30 mb-3" />
                <p className="text-xs text-muted">Paste a GitHub PR URL above</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto p-3 border-t border-border shrink-0">
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
