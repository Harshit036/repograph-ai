'use client'
import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import {
  BookOpen, Code2, TreePine, Network, GitBranch,
  Loader2, AlertCircle, Search, X, ChevronLeft,
  Sparkles, Play,
} from 'lucide-react'
import { api } from '@/lib/api'
import { graphToPlotly } from '@/lib/graph-to-plotly'
import { useWorkspace, ToolTab, ToolResult } from '@/store/workspace'
import dynamic from 'next/dynamic'

const TreeView = dynamic(() => import('./TreeView'), { ssr: false })

// ── Shared markdown renderer ───────────────────────────────────────────────────

function MdContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      className="prose prose-invert prose-sm max-w-none
        prose-headings:text-white prose-headings:font-semibold
        prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:my-1
        prose-li:text-zinc-300 prose-li:my-0.5
        prose-code:text-violet-400 prose-code:bg-s2 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:font-mono
        prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:text-xs
        prose-strong:text-white prose-a:text-accent"
    >
      {text}
    </ReactMarkdown>
  )
}

// ── Plotly ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PlotContainer({ plotData, height = 320 }: { plotData: any; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || !plotData) return
    let cancelled = false
    import('plotly.js-dist-min').then((P: unknown) => {
      if (cancelled || !ref.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(P as any).newPlot(ref.current, plotData.data, {
        ...plotData.layout, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
        autosize: true, margin: { t: 10, b: 10, l: 10, r: 10 },
      }, { responsive: true, displayModeBar: false })
    })
    return () => { cancelled = true }
  }, [plotData])
  return <div ref={ref} style={{ width: '100%', height }} />
}

// ── Flow trace ─────────────────────────────────────────────────────────────────

function TraceView({ repoReady }: { repoReady: boolean }) {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ function: string; file: string; calls: string[] }[]>([])
  const [error, setError] = useState('')

  const search = async () => {
    if (!keyword.trim()) return
    setLoading(true); setError('')
    try { setResults(await api.trace(keyword.trim())) }
    catch { setError('Trace failed.') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. generate_embedding" disabled={!repoReady}
          className="flex-1 bg-s2 border border-border text-white placeholder-muted rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent disabled:opacity-50 font-mono"
        />
        <button onClick={search} disabled={!repoReady || loading || !keyword.trim()}
          className="bg-accent hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg px-3 py-2 transition-colors flex-shrink-0">
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
          {r.calls.length > 0 && r.calls.map((c, j) => (
            <p key={j} className="text-[11px] text-zinc-400 ml-2">→ {c}</p>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Tool card definitions ──────────────────────────────────────────────────────

interface ToolDef {
  id: ToolTab
  label: string
  icon: React.ElementType
  description: string
  color: string
}

const TOOLS: ToolDef[] = [
  { id: 'onboarding',   label: 'Onboarding Guide',     icon: BookOpen,  description: 'Entry points, setup steps, and key modules for new contributors', color: 'text-emerald-400' },
  { id: 'architecture', label: 'Architecture Summary',  icon: Code2,     description: 'AI-generated overview of layers, patterns, and design decisions',  color: 'text-blue-400' },
  { id: 'tree',         label: 'File Tree',             icon: TreePine,  description: 'Visual sunburst of the repository file structure and sizes',        color: 'text-amber-400' },
  { id: 'graph',        label: '3D Dependency Graph',   icon: Network,   description: 'Interactive 3D graph of imports, calls, and module relationships',  color: 'text-violet-400' },
  { id: 'trace',        label: 'Flow Tracer',           icon: GitBranch, description: 'Trace call chains and execution paths for any function or keyword', color: 'text-pink-400' },
]

// ── Onboarding content ────────────────────────────────────────────────────────

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
      {d.guide && <MdContent text={d.guide} />}
    </div>
  )
}

// ── Detail view (opened from a card) ──────────────────────────────────────────

function DetailView({
  tool, result, repoReady, onBack, onGenerate,
}: {
  tool: ToolDef
  result: ToolResult | undefined
  repoReady: boolean
  onBack: () => void
  onGenerate: () => void
}) {
  const Icon = tool.icon
  const isPlotly = tool.id === 'tree' || tool.id === 'graph'
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
        <button onClick={onBack} className="text-muted hover:text-white transition-colors p-1 -ml-1 rounded">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Icon className={`w-4 h-4 ${tool.color} flex-shrink-0`} />
        <span className="text-sm font-semibold text-white flex-1 truncate">{tool.label}</span>
        {tool.id !== 'trace' && (
          <button
            onClick={onGenerate}
            disabled={!repoReady || result?.loading}
            className="flex items-center gap-1.5 bg-accent hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
          >
            {result?.loading
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
              : <><Play className="w-3 h-3" /> {result?.data ? 'Regenerate' : 'Generate'}</>
            }
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!repoReady && (
          <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-lg p-3">
            <AlertCircle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-warning">Ingest a repository first.</p>
          </div>
        )}

        {result?.error && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg p-3">
            <AlertCircle className="w-3.5 h-3.5 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-xs text-danger">{String(result.error)}</p>
          </div>
        )}

        {tool.id === 'trace' && <TraceView repoReady={repoReady} />}

        {result?.loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-xs text-muted">Analysing repository…</p>
          </div>
        )}

        {!!result?.data && !result.loading && (
          <>
            {tool.id === 'onboarding' && <OnboardingContent data={result.data} />}

            {tool.id === 'architecture' && (
              <MdContent text={(result.data as { summary: string }).summary} />
            )}

            {tool.id === 'tree' && (
              <div className="h-[420px]">
                <TreeView data={result.data} />
              </div>
            )}
            {tool.id === 'graph' && (
              <div className="rounded-xl overflow-hidden border border-border">
                <PlotContainer plotData={result.data} height={380} />
              </div>
            )}
          </>
        )}

        {!result?.data && !result?.loading && !result?.error && tool.id !== 'trace' && repoReady && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className={`w-10 h-10 rounded-full bg-s2 border border-border flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${tool.color}`} />
            </div>
            <p className="text-xs text-muted">Click Generate to analyse the repository.</p>
          </div>
        )}
      </div>

      {/* Fullscreen plotly */}
      {fullscreen && isPlotly && !!result?.data && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-5xl h-[82vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
              <span className="text-sm font-medium text-white">{tool.label}</span>
              <button onClick={() => setFullscreen(false)} className="text-muted hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <PlotContainer plotData={result.data} height={600} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Card grid (home view) ──────────────────────────────────────────────────────

function CardGrid({
  toolResults, repoReady, onOpen,
}: {
  toolResults: Partial<Record<ToolTab, ToolResult>>
  repoReady: boolean
  onOpen: (id: ToolTab) => void
}) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-4">Analysis Tools</p>
      {TOOLS.map(tool => {
        const result = toolResults[tool.id]
        const Icon = tool.icon
        const hasData = !!result?.data
        const isLoading = !!result?.loading

        return (
          <button
            key={tool.id}
            onClick={() => onOpen(tool.id)}
            className="w-full text-left bg-s2/50 hover:bg-s2 border border-border hover:border-muted rounded-xl p-3.5 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg bg-s2 border border-border flex items-center justify-center flex-shrink-0 group-hover:border-muted transition-colors`}>
                {isLoading
                  ? <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  : <Icon className={`w-4 h-4 ${tool.color}`} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-white">{tool.label}</p>
                  {hasData && !isLoading && (
                    <span className="text-[10px] bg-success/15 text-success border border-success/30 px-1.5 py-0.5 rounded-full flex-shrink-0">Ready</span>
                  )}
                </div>
                <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{tool.description}</p>
              </div>
            </div>
          </button>
        )
      })}

      {!repoReady && (
        <div className="flex items-start gap-2.5 bg-s2/30 border border-border rounded-xl p-3.5 mt-2">
          <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted leading-relaxed">
            Ingest a repository from the left panel to unlock all tools.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function RightPanel() {
  const store = useWorkspace()
  const activeToolTab = store.activeToolTab as ToolTab
  const toolResults = store.toolResults as Partial<Record<ToolTab, ToolResult>>
  const currentRepo = store.currentRepo
  const { setActiveToolTab, setToolResult } = store
  const [openTool, setOpenTool] = useState<ToolTab | null>(null)
  const repoReady = !!currentRepo

  const activeTool = TOOLS.find(t => t.id === openTool)

  const generate = async (tab: ToolTab) => {
    setToolResult(tab, { loading: true, data: null })
    try {
      let data: unknown
      switch (tab) {
        case 'onboarding':   data = await api.onboarding(); break
        case 'architecture': data = await api.architecture(); break
        case 'tree':         data = await api.tree(); break           // raw flat-tree data → TreeView
        case 'graph':        data = graphToPlotly(await api.graph()); break  // plotly format → PlotContainer
        default:             data = null
      }
      setToolResult(tab, { loading: false, data })
    } catch (e: unknown) {
      setToolResult(tab, { loading: false, data: null, error: e instanceof Error ? e.message : 'Failed' })
    }
  }

  return (
    <aside className="h-full flex flex-col border-l border-border bg-surface overflow-hidden">
      {openTool && activeTool ? (
        <DetailView
          tool={activeTool}
          result={toolResults[openTool]}
          repoReady={repoReady}
          onBack={() => setOpenTool(null)}
          onGenerate={() => generate(openTool)}
        />
      ) : (
        <div className="h-full overflow-y-auto">
          <CardGrid toolResults={toolResults} repoReady={repoReady} onOpen={tab => {
            setActiveToolTab(tab)
            setOpenTool(tab)
          }} />
        </div>
      )}
    </aside>
  )
}
