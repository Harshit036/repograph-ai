'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { BookOpen, Sparkles, AlertCircle, FileCode2 } from 'lucide-react'

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

interface OnboardingResult {
  guide: string
  entry_points: { file: string; reasons: string[] }[]
}

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<OnboardingResult | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const generate = async () => {
    setLoading(true); setError(null)
    try {
      setResult(await api.onboarding())
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
          <h1 className="text-2xl font-bold text-white">Onboarding Guide</h1>
          <p className="text-muted text-sm mt-1">Auto-generated guide for new developers joining the project</p>
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

      {!result && !loading && !error && (
        <div className="bg-surface border border-dashed border-border rounded-xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-border mx-auto mb-3" strokeWidth={1} />
          <p className="text-muted text-sm">Click Generate to create a developer onboarding guide</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Entry points */}
          {result.entry_points?.length > 0 && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-6 py-3 border-b border-border">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Entry Points</h2>
              </div>
              <div className="divide-y divide-border">
                {result.entry_points.map((ep, i) => (
                  <div key={i} className="flex items-start gap-4 px-6 py-3">
                    <FileCode2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-mono text-white">{ep.file}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {ep.reasons.map((r, j) => (
                          <span key={j} className="text-xs bg-s2 text-muted px-2 py-0.5 rounded-full">{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Guide */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="space-y-1">{renderMarkdown(result.guide)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
