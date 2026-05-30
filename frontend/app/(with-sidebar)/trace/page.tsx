'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { GitBranch, Search, AlertCircle, ChevronRight, ArrowRight } from 'lucide-react'

interface TraceItem { function: string; file: string; calls: string[] }

function Spinner() {
  return <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
}

function TraceCard({ item }: { item: TraceItem }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-s2 transition-colors"
      >
        <ChevronRight className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="text-sm font-mono font-semibold text-accent">{item.function}</span>
        <span className="text-muted">—</span>
        <span className="text-xs font-mono text-muted truncate flex-1">{item.file.split('/').slice(-2).join('/')}</span>
        {item.calls.length > 0 && (
          <span className="text-xs bg-s2 text-muted px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
            {item.calls.length} calls
          </span>
        )}
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-border">
          {item.calls.length === 0 ? (
            <p className="text-xs text-muted mt-3 italic">No outgoing calls detected</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.calls.map((call, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ArrowRight className="w-3 h-3 text-border" />}
                  <span className="text-xs font-mono bg-s2 text-violet-400 px-2 py-1 rounded">{call}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TracePage() {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<TraceItem[] | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const handleTrace = async () => {
    if (!keyword.trim()) return
    setLoading(true); setError(null); setResults(null)
    try {
      const data = await api.trace(keyword.trim())
      setResults(data)
    } catch {
      setError('Trace failed. Make sure the API is running and a repo has been ingested.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Flow Trace</h1>
        <p className="text-muted text-sm mt-1">Search by function keyword and trace its call chain across the codebase</p>
      </div>

      {/* Input */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && handleTrace()}
              placeholder="e.g. generate_embedding, hybrid_search…"
              className="w-full bg-s2 border border-border text-white placeholder-muted rounded-lg pl-10 pr-4 py-2.5 text-sm font-mono focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <button
            onClick={handleTrace}
            disabled={loading || !keyword.trim()}
            className="flex items-center gap-2 bg-accent hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
          >
            {loading ? <Spinner /> : <GitBranch className="w-4 h-4" />}
            {loading ? 'Tracing…' : 'Trace'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-danger/10 border border-danger/30 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Results */}
      {results !== null && results.length === 0 && (
        <div className="bg-surface border border-dashed border-border rounded-xl p-10 text-center">
          <GitBranch className="w-8 h-8 text-border mx-auto mb-2" strokeWidth={1} />
          <p className="text-muted text-sm">No functions matching <code className="text-violet-400 font-mono">{keyword}</code> found</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted">{results.length} match{results.length !== 1 ? 'es' : ''} found</p>
          {results.map((item, i) => <TraceCard key={i} item={item} />)}
        </div>
      )}
    </div>
  )
}
