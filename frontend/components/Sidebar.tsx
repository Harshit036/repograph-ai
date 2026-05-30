'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Upload, MessageSquare, Bot,
  Network, Code2, BookOpen, GitBranch, Hexagon, TreePine,
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { href: '/',              label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/ingest',        label: 'Ingest',       icon: Upload },
  { href: '/query',         label: 'RAG Query',    icon: MessageSquare },
  { href: '/agent',         label: 'Agent',        icon: Bot },
  { href: '/graph',         label: 'Dep. Graph',   icon: Network },
  { href: '/tree',          label: 'Repo Tree',    icon: TreePine },
  { href: '/architecture',  label: 'Architecture', icon: Code2 },
  { href: '/onboarding',    label: 'Onboarding',   icon: BookOpen },
  { href: '/trace',         label: 'Flow Trace',   icon: GitBranch },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside className="fixed top-0 left-0 h-screen w-[220px] bg-surface border-r border-border flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
          <Hexagon className="w-4 h-4 text-accent" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">RepoGraph</p>
          <p className="text-[10px] text-muted mt-0.5">AI Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                active
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-muted hover:bg-s2 hover:text-zinc-100 border border-transparent'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={active ? 2 : 1.5} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <p className="text-[10px] text-muted leading-relaxed">
          Powered by LangGraph · pgvector · Ollama
        </p>
      </div>
    </aside>
  )
}
