'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Bot, Send, AlertCircle, Search, Brain, Lightbulb, RotateCcw, ChevronRight } from 'lucide-react'

interface AgentResult {
  response: string
  actions: string[]
  memory: { discovered_facts: string[]; searched_queries: string[] }
}

function Spinner() {
  return <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
}

function stepStyle(action: string): { icon: React.ElementType; color: string; bg: string } {
  if (action.includes('Iteration'))    return { icon: ChevronRight,  color: 'text-zinc-300',   bg: 'bg-zinc-700/30 border-zinc-700' }
  if (action.includes('Planner'))      return { icon: Brain,         color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' }
  if (action.includes('Retriever'))    return { icon: Search,        color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' }
  if (action.includes('Reasoner'))     return { icon: Lightbulb,     color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30' }
  if (action.includes('Self-correction') || action.includes('Correction')) return { icon: RotateCcw, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' }
  if (action.includes('Learned') || action.includes('Gaps'))   return { icon: Lightbulb, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' }
  return { icon: ChevronRight, color: 'text-muted', bg: 'bg-s2 border-border' }
}

function renderResponse(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />
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

export default function AgentPage() {
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<AgentResult | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const handleRun = async () => {
    if (!query.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      setResult(await api.agentQuery(query.trim()))
    } catch {
      setError('Agent failed. Make sure the API is running and a repo has been ingested.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Agent Query</h1>
        <p className="text-muted text-sm mt-1">LangGraph agent with planner → retriever → reasoner → summarizer</p>
      </div>

      {/* Input */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Bot className="w-4 h-4 text-muted mt-2.5 flex-shrink-0" />
          <textarea
            rows={3}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); !loading && handleRun() } }}
            placeholder="Explain the RAG pipeline architecture in this codebase…"
            className="flex-1 bg-s2 border border-border text-white placeholder-muted rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors resize-none"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleRun}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 bg-accent hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? <Spinner /> : <Send className="w-4 h-4" />}
            {loading ? 'Agent running…' : 'Run Agent'}
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

      {result && (
        <div className="space-y-4">
          {/* Trace */}
          {result.actions.length > 0 && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-6 py-3 border-b border-border">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Agent Trace — {result.actions.length} steps
                </h2>
              </div>
              <div className="p-4 space-y-1.5 max-h-72 overflow-y-auto">
                {result.actions.map((action, i) => {
                  const { icon: Icon, color, bg } = stepStyle(action)
                  return (
                    <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-xs font-mono ${bg}`}>
                      <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${color}`} strokeWidth={1.5} />
                      <span className={color}>{action}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Response */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Final Answer</h2>
            <div className="space-y-1">{renderResponse(result.response)}</div>
          </div>

          {/* Memory */}
          {(result.memory.discovered_facts.length > 0 || result.memory.searched_queries.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-xl p-4">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Discovered Facts</h3>
                {result.memory.discovered_facts.length === 0
                  ? <p className="text-xs text-muted">None</p>
                  : result.memory.discovered_facts.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                      <p className="text-xs text-zinc-300">{f}</p>
                    </div>
                  ))
                }
              </div>
              <div className="bg-surface border border-border rounded-xl p-4">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Searched Queries</h3>
                {result.memory.searched_queries.length === 0
                  ? <p className="text-xs text-muted">None</p>
                  : result.memory.searched_queries.map((q, i) => (
                    <div key={i} className="bg-s2 rounded px-2 py-1 font-mono text-xs text-zinc-300 mb-1.5">{q}</div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
