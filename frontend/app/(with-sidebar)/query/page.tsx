'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { MessageSquare, Send, FileCode2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'

interface Citation { source_id: number; file: string; file_path: string; preview: string }
interface Result   { response: string; citations: Citation[] }

function Spinner() {
  return <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
}

function CitationCard({ c }: { c: Citation }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-s2 border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-s2/80 transition-colors"
      >
        <span className="text-xs font-mono bg-accent/20 text-accent px-1.5 py-0.5 rounded">
          [{c.source_id}]
        </span>
        <FileCode2 className="w-3.5 h-3.5 text-muted flex-shrink-0" />
        <span className="text-sm text-zinc-300 font-mono truncate flex-1">{c.file}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <pre className="bg-bg rounded-lg p-3 text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap border border-border">
            {c.preview}
          </pre>
        </div>
      )}
    </div>
  )
}

function renderResponse(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-white mt-4 mb-1">{line.slice(4)}</h3>
    if (line.startsWith('## '))  return <h2 key={i} className="text-lg font-semibold text-white mt-5 mb-1">{line.slice(3)}</h2>
    if (line.startsWith('# '))   return <h1 key={i} className="text-xl font-bold text-white mt-5 mb-2">{line.slice(2)}</h1>
    if (line.startsWith('- ') || line.startsWith('* '))
      return <li key={i} className="text-sm text-zinc-300 ml-4 list-disc mb-1">{line.slice(2)}</li>
    if (!line.trim()) return <div key={i} className="h-2" />
    // Inline code
    const parts = line.split(/(`[^`]+`)/)
    return (
      <p key={i} className="text-sm text-zinc-300 leading-relaxed mb-1">
        {parts.map((p, j) =>
          p.startsWith('`') && p.endsWith('`')
            ? <code key={j} className="bg-s2 text-violet-400 px-1 rounded font-mono text-xs">{p.slice(1, -1)}</code>
            : p
        )}
      </p>
    )
  })
}

export default function QueryPage() {
  const [query, setQuery]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<Result | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const handleAsk = async () => {
    if (!query.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      setResult(await api.ragQuery(query.trim()))
    } catch {
      setError('Query failed. Make sure the API is running and a repo has been ingested.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">RAG Query</h1>
        <p className="text-muted text-sm mt-1">Ask questions grounded in your indexed repositories</p>
      </div>

      {/* Input */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <MessageSquare className="w-4 h-4 text-muted mt-2.5 flex-shrink-0" />
          <textarea
            rows={3}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); !loading && handleAsk() } }}
            placeholder="How does the embedding pipeline work? (Shift+Enter for newline)"
            className="flex-1 bg-s2 border border-border text-white placeholder-muted rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors resize-none"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleAsk}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 bg-accent hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? <Spinner /> : <Send className="w-4 h-4" />}
            {loading ? 'Searching…' : 'Ask'}
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

      {/* Response */}
      {result && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Response</h2>
            <div className="space-y-1">{renderResponse(result.response)}</div>
          </div>

          {result.citations.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                Sources — {result.citations.length} citations
              </h2>
              <div className="space-y-2">
                {result.citations.map(c => <CitationCard key={c.source_id} c={c} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
