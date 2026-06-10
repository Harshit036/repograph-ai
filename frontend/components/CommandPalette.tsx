'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, FileCode2, Code2, X, Loader2, Hash } from 'lucide-react'
import { api } from '@/lib/api'
import { useWorkspace } from '@/store/workspace'

interface SearchResult {
  files: { file_path: string; display: string; language: string }[]
  functions: { name: string; file_path: string; display: string; line: number }[]
  code: { file_path: string; display: string; line: number; snippet: string }[]
}

const LANG_COLOR: Record<string, string> = {
  python: '#3b82f6', typescript: '#8b5cf6', javascript: '#f59e0b',
  go: '#10b981', java: '#ef4444', rust: '#f97316',
}

export default function CommandPalette() {
  const { openCodeViewer } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) { setQ(''); setResults(null); setSelected(0); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  const search = useCallback((query: string) => {
    if (!query.trim()) { setResults(null); return }
    setLoading(true)
    api.globalSearch(query)
      .then(r => { setResults(r); setSelected(0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleInput = (val: string) => {
    setQ(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 250)
  }

  // Flatten results for keyboard navigation
  const flat = results ? [
    ...results.files.map(r => ({ type: 'file' as const, ...r, name: r.display, line: 0 })),
    ...results.functions.map(r => ({ type: 'fn' as const, ...r, name: r.name })),
    ...results.code.map(r => ({ type: 'code' as const, ...r, name: r.display })),
  ] : []

  const navigate = (item: typeof flat[0]) => {
    openCodeViewer(item.file_path, item.line || 1)
    setOpen(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, flat.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && flat[selected]) navigate(flat[selected])
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl mx-4 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {loading
            ? <Loader2 className="w-4 h-4 text-muted animate-spin flex-shrink-0" />
            : <Search className="w-4 h-4 text-muted flex-shrink-0" />}
          <input
            ref={inputRef}
            value={q}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search files, functions, or code…"
            className="flex-1 bg-transparent text-white placeholder-muted text-sm focus:outline-none"
          />
          {q && (
            <button onClick={() => { setQ(''); setResults(null) }} className="text-muted hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="text-[10px] text-muted bg-s2 border border-border px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {!q && (
            <p className="text-xs text-muted text-center py-8">Type to search files, functions, and code</p>
          )}
          {q && !loading && results && flat.length === 0 && (
            <p className="text-xs text-muted text-center py-8">No results for &ldquo;{q}&rdquo;</p>
          )}

          {results && results.files.length > 0 && (
            <Section label="Files">
              {results.files.map((item, i) => {
                const idx = i
                const color = LANG_COLOR[item.language] ?? '#71717a'
                return (
                  <ResultRow key={item.file_path} selected={selected === idx}
                    onClick={() => navigate({ type: 'file', ...item, name: item.display, line: 0 })}
                    onHover={() => setSelected(idx)}>
                    <FileCode2 className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                    <span className="font-mono text-xs text-zinc-300 truncate">{item.display}</span>
                  </ResultRow>
                )
              })}
            </Section>
          )}

          {results && results.functions.length > 0 && (
            <Section label="Functions">
              {results.functions.map((item, i) => {
                const idx = results.files.length + i
                return (
                  <ResultRow key={`${item.file_path}:${item.name}`} selected={selected === idx}
                    onClick={() => navigate({ type: 'fn', ...item, name: item.name })}
                    onHover={() => setSelected(idx)}>
                    <Hash className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="text-xs text-white font-mono">{item.name}</span>
                    <span className="text-[11px] text-muted truncate ml-auto">{item.display}</span>
                    {item.line > 0 && <span className="text-[10px] text-muted shrink-0">:{item.line}</span>}
                  </ResultRow>
                )
              })}
            </Section>
          )}

          {results && results.code.length > 0 && (
            <Section label="Code">
              {results.code.map((item, i) => {
                const idx = results.files.length + results.functions.length + i
                return (
                  <ResultRow key={`${item.file_path}:${item.line}:${i}`} selected={selected === idx}
                    onClick={() => navigate({ type: 'code', ...item, name: item.display })}
                    onHover={() => setSelected(idx)}>
                    <Code2 className="w-3.5 h-3.5 text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-400 font-mono truncate">{item.display}{item.line > 0 && `:${item.line}`}</p>
                      <p className="text-[10px] text-muted font-mono truncate mt-0.5">{item.snippet.slice(0, 80)}</p>
                    </div>
                  </ResultRow>
                )
              })}
            </Section>
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-border">
          <span className="text-[10px] text-muted">↑↓ navigate</span>
          <span className="text-[10px] text-muted">↵ open in explorer</span>
          <span className="text-[10px] text-muted ml-auto">⌘K to close</span>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wider px-4 pt-3 pb-1">{label}</p>
      {children}
    </div>
  )
}

function ResultRow({ selected, onClick, onHover, children }: {
  selected: boolean; onClick: () => void; onHover: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors ${
        selected ? 'bg-accent/15' : 'hover:bg-s2'
      }`}
    >
      {children}
    </button>
  )
}
