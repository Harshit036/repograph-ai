'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Code2, Sparkles, AlertCircle } from 'lucide-react'

function Spinner() {
  return <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-white mt-5 mb-1.5">{line.slice(4)}</h3>
    if (line.startsWith('## '))  return <h2 key={i} className="text-lg font-semibold text-white mt-6 mb-2 border-b border-border pb-1">{line.slice(3)}</h2>
    if (line.startsWith('# '))   return <h1 key={i} className="text-xl font-bold text-white mt-6 mb-2">{line.slice(2)}</h1>
    if (line.startsWith('- ') || line.startsWith('* '))
      return <li key={i} className="text-sm text-zinc-300 ml-5 list-disc mb-1 leading-relaxed">{line.slice(2)}</li>
    if (!line.trim()) return <div key={i} className="h-3" />
    const parts = line.split(/(`[^`]+`)/)
    return (
      <p key={i} className="text-sm text-zinc-300 leading-relaxed mb-1">
        {parts.map((p, j) =>
          p.startsWith('`') && p.endsWith('`')
            ? <code key={j} className="bg-s2 text-violet-400 px-1.5 rounded font-mono text-xs">{p.slice(1, -1)}</code>
            : p
        )}
      </p>
    )
  })
}

export default function ArchitecturePage() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const generate = async () => {
    setLoading(true); setError(null)
    try {
      const data = await api.architecture()
      setSummary(data.summary)
    } catch {
      setError('Failed to generate. Make sure a repository has been ingested.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Architecture Summary</h1>
          <p className="text-muted text-sm mt-1">LLM-generated overview of module responsibilities and data flow</p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 bg-accent hover:bg-violet-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? <Spinner /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-danger/10 border border-danger/30 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {!summary && !loading && !error && (
        <div className="bg-surface border border-dashed border-border rounded-xl p-12 text-center">
          <Code2 className="w-10 h-10 text-border mx-auto mb-3" strokeWidth={1} />
          <p className="text-muted text-sm">Click Generate to analyse your repository architecture</p>
        </div>
      )}

      {summary && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="space-y-1">{renderMarkdown(summary)}</div>
        </div>
      )}
    </div>
  )
}
