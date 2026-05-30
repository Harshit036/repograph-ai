'use client'
import { useState, useEffect, useRef } from 'react'
import { BookOpen, Code2, TreePine, Network, GitBranch, Loader2, AlertCircle, Search, Maximize2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { graphToPlotly } from '@/lib/graph-to-plotly'
import { useWorkspace, ToolTab, ToolResult } from '@/store/workspace'

const TABS: { id: ToolTab; label: string; icon: React.ElementType }[] = [
  { id: 'onboarding',   label: 'Guide',    icon: BookOpen },
  { id: 'architecture', label: 'Arch.',    icon: Code2 },
  { id: 'tree',         label: 'Tree',     icon: TreePine },
  { id: 'graph',        label: '3D Graph', icon: Network },
  { id: 'trace',        label: 'Trace',    icon: GitBranch },
]

function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-white mt-3 mb-1">{line.slice(4)}</h3>
        if (line.startsWith('## '))  return <h2 key={i} className="text-sm font-bold text-white mt-4 mb-1">{line.slice(3)}</h2>
        if (line.startsWith('# '))   return <h1 key={i} className="text-base font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="text-xs text-zinc-300 ml-3 list-disc mb-0.5">{line.slice(2)}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        const parts = line.split(/(`[^`]+`)/)
        return (
          <p key={i} className="text-xs text-zinc-300 leading-relaxed">
            {parts.map((p, j) =>
              p.startsWith('`') && p.endsWith('`')
                ? <code key={j} className="bg-s2 text-violet-400 px-1 rounded font-mono">{p.slice(1, -1)}</code>
                : p
            )}
          </p>
        )
      })}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PlotContainer({ plotData, height = 260 }: { plotData: any; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !plotData) return
    let cancelled = false
    import('plotly.js-dist-min').then((Plotly: unknown) => {
      if (cancelled || !ref.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const P = Plotly as any
      P.newPlot(ref.current, plotData.data, {
        ...plotData.layout,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        autosize: true,
        margin: { t: 20, b: 20, l: 20, r: 20 },
      }, { responsive: true, displayModeBar: false })
    })
    return () => { cancelled = true }
  }, [plotData])

  return <div ref={ref} style={{ width: '100%', height }} />
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PlotModal({ plotData, onClose }: { plotData: any; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !plotData) return
    let cancelled = false
    import('plotly.js-dist-min').then((Plotly: unknown) => {
      if (cancelled || !ref.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const P = Plotly as any
      P.newPlot(ref.current, plotData.data, {
        ...plotData.layout,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        autosize: true,
      }, { responsive: true, displayModeBar: true })
    })
    return () => { cancelled = true }
  }, [plotData])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-5xl h-[82vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <span className="text-sm font-medium text-white">Full View</span>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div ref={ref} className="flex-1 min-h-0" />
      </div>
    </div>
  )
}

function OnboardingContent({ data }: { data: unknown }) {
  const d = data as { guide: string; entry_points: { file: string; reasons: string[] }[] }
  return (
    <div className="space-y-4">
      {d.entry_points?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Entry Points</p>
          {d.entry_points.map((ep, i) => (
            <div key={i} className="bg-s2 border border-border rounded-lg p-3">
              <p className="text-xs font-mono text-violet-400 truncate">{ep.file}</p>
              {ep.reasons.map((r, j) => (
                <p key={j} className="text-[11px] text-zinc-400 mt-1 leading-relaxed">• {r}</p>
              ))}
            </div>
          ))}
        </div>
      )}
      {d.guide && (
        <div>
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">Guide</p>
          <MarkdownContent text={d.guide} />
        </div>
      )}
    </div>
  )
}

function TraceContent({ repoReady }: { repoReady: boolean }) {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ function: string; file: string; calls: string[] }[]>([])
  const [error, setError] = useState('')

  const search = async () => {
    if (!keyword.trim()) return
    setLoading(true); setError('')
    try {
      setResults(await api.trace(keyword.trim()))
    } catch {
      setError('Trace failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. generate_embedding"
          disabled={!repoReady}
          className="flex-1 bg-s2 border border-border text-white placeholder-muted rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent disabled:opacity-50 font-mono"
        />
        <button
          onClick={search}
          disabled={!repoReady || loading || !keyword.trim()}
          className="bg-accent hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg px-3 py-2 transition-colors flex-shrink-0"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {results.length === 0 && !loading && keyword && (
        <p className="text-xs text-muted">No results for &ldquo;{keyword}&rdquo;</p>
      )}
      {results.map((r, i) => (
        <div key={i} className="bg-s2 border border-border rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-mono text-violet-400">{r.function}</p>
          <p className="text-[11px] text-muted font-mono truncate">{r.file}</p>
          {r.calls.length > 0 && (
            <div className="space-y-0.5">
              {r.calls.map((c, j) => (
                <p key={j} className="text-[11px] text-zinc-400 ml-2">→ {c}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function RightPanel() {
  const store = useWorkspace()
  const activeToolTab = store.activeToolTab as ToolTab
  const toolResults = store.toolResults as Partial<Record<ToolTab, ToolResult>>
  const currentRepo = store.currentRepo
  const { setActiveToolTab, setToolResult } = store
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fullscreenData, setFullscreenData] = useState<any>(null)
  const repoReady = !!currentRepo

  const currentResult = toolResults[activeToolTab]
  const isPlotlyTab = activeToolTab === 'tree' || activeToolTab === 'graph'
  const showGenerate = activeToolTab !== 'trace'

  const generate = async () => {
    setToolResult(activeToolTab, { loading: true, data: null })
    try {
      let data: unknown
      switch (activeToolTab) {
        case 'onboarding':   data = await api.onboarding(); break
        case 'architecture': data = await api.architecture(); break
        case 'tree':         data = await api.tree(); break
        case 'graph':        data = graphToPlotly(await api.graph()); break
        default:             data = null
      }
      setToolResult(activeToolTab, { loading: false, data })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed'
      setToolResult(activeToolTab, { loading: false, data: null, error: msg })
    }
  }

  return (
    <aside className="w-[340px] flex-shrink-0 flex flex-col border-l border-border bg-surface overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border bg-s2/50 overflow-x-auto flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveToolTab(id)}
            className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap transition-all border-b-2 ${
              activeToolTab === id
                ? 'border-accent text-white'
                : 'border-transparent text-muted hover:text-zinc-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {showGenerate ? (
          <div className="flex items-center gap-2">
            <button
              onClick={generate}
              disabled={!repoReady || Boolean(currentResult?.loading)}
              className="flex items-center gap-2 bg-accent hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
            >
              {currentResult?.loading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                : 'Generate'
              }
            </button>
            {(isPlotlyTab && !!currentResult?.data) ? (
              <button
                onClick={() => setFullscreenData(currentResult.data)}
                className="flex items-center gap-1.5 border border-border text-muted hover:text-white hover:border-muted px-3 py-2 rounded-lg text-xs transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Expand
              </button>
            ) : null}
          </div>
        ) : null}

        {currentResult?.error ? (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg p-3">
            <AlertCircle className="w-3.5 h-3.5 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-xs text-danger">{String(currentResult.error)}</p>
          </div>
        ) : null}

        {activeToolTab === 'trace' ? <TraceContent repoReady={repoReady} /> : null}

        {(!currentResult?.data && !currentResult?.loading && !currentResult?.error && activeToolTab !== 'trace') ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-xs text-muted">
              {!repoReady ? 'Ingest a repository first, then click Generate.' : 'Click Generate to analyze the repository.'}
            </p>
          </div>
        ) : null}

        {(!!currentResult?.data && !currentResult?.loading) ? (
          <>
            {activeToolTab === 'onboarding' ? <OnboardingContent data={currentResult.data} /> : null}
            {activeToolTab === 'architecture' ? (
              <MarkdownContent text={(currentResult.data as { summary: string }).summary} />
            ) : null}
            {isPlotlyTab ? (
              <div className="rounded-xl overflow-hidden border border-border">
                <PlotContainer plotData={currentResult.data} height={260} />
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {fullscreenData ? (
        <PlotModal plotData={fullscreenData} onClose={() => setFullscreenData(null)} />
      ) : null}
    </aside>
  )
}
