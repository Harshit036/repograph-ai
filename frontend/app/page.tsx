'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import {
  Database, FileCode2, Layers, FunctionSquare,
  Upload, MessageSquare, Bot, Network, Code2, BookOpen, GitBranch,
  ArrowRight, Activity, TreePine,
} from 'lucide-react'

interface Stats { repos: number; files: number; chunks: number; functions: number }

function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ElementType; label: string; value: number | string; color: string
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-muted mt-0.5">{label}</p>
      </div>
    </div>
  )
}

const quickActions = [
  { href: '/ingest',       label: 'Ingest a Repo',   desc: 'Clone & index a GitHub repository',   icon: Upload,       color: 'text-violet-400' },
  { href: '/query',        label: 'RAG Query',        desc: 'Ask questions grounded in code',       icon: MessageSquare, color: 'text-blue-400' },
  { href: '/agent',        label: 'Run Agent',        desc: 'LangGraph multi-step reasoning',       icon: Bot,          color: 'text-emerald-400' },
  { href: '/graph',        label: 'Dep. Graph',        desc: 'Interactive 3D dependency graph',      icon: Network,      color: 'text-amber-400' },
  { href: '/tree',         label: 'Repo Tree',         desc: 'Sunburst file tree by chunk density',  icon: TreePine,     color: 'text-teal-400' },
  { href: '/architecture', label: 'Architecture',     desc: 'Auto-generated architecture overview', icon: Code2,        color: 'text-pink-400' },
  { href: '/onboarding',   label: 'Onboarding Guide', desc: 'New-dev guide with entry points',     icon: BookOpen,     color: 'text-cyan-400' },
  { href: '/trace',        label: 'Flow Trace',       desc: 'Trace call chains by keyword',         icon: GitBranch,    color: 'text-orange-400' },
]

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    api.health()
      .then(() => setOnline(true))
      .catch(() => setOnline(false))

    api.stats()
      .then(setStats)
      .catch(() => setStats({ repos: 0, files: 0, chunks: 0, functions: 0 }))
  }, [])

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-muted text-sm mt-1">Repository Intelligence Platform</p>
        </div>
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
          <Activity className="w-3.5 h-3.5 text-muted" />
          {online === null && <span className="text-xs text-muted">Checking API…</span>}
          {online === true && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success">API Online</span>
            </>
          )}
          {online === false && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-danger" />
              <span className="text-xs text-danger">API Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Database}       label="Repos indexed"    value={stats?.repos     ?? '—'} color="bg-violet-500/10 text-violet-400" />
        <StatCard icon={FileCode2}      label="Files analyzed"   value={stats?.files     ?? '—'} color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={Layers}         label="Chunks stored"    value={stats?.chunks    ?? '—'} color="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={FunctionSquare} label="Functions mapped" value={stats?.functions ?? '—'} color="bg-amber-500/10 text-amber-400" />
      </div>

      {/* Empty state */}
      {stats?.repos === 0 && (
        <div className="bg-surface border border-dashed border-border rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6 text-accent" />
          </div>
          <p className="text-white font-medium">No repositories indexed yet</p>
          <p className="text-muted text-sm mt-1 mb-4">Ingest a GitHub repo to get started</p>
          <Link
            href="/ingest"
            className="inline-flex items-center gap-2 bg-accent hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" /> Ingest your first repo
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map(({ href, label, desc, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="group bg-surface border border-border hover:border-accent/40 rounded-xl p-4 flex items-start gap-3 transition-all duration-150 hover:bg-s2"
            >
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${color}`} strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-border group-hover:text-muted transition-colors flex-shrink-0 mt-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
