'use client'
import { useState, useCallback } from 'react'
import {
  BookOpen, Code2, GitBranch,
  Loader2, AlertCircle, Search, ChevronLeft,
  Sparkles, Play, Bug, TestTube2, ChevronDown, ChevronRight,
  ExternalLink, ArrowDown, ArrowUp, Copy, Check,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useWorkspace, ToolTab, ToolResult } from '@/store/workspace'
import { openGithubBlob } from '@/lib/github'
import { MarkdownRenderer } from '@/components/markdown'

// ── Shared markdown renderer ───────────────────────────────────────────────────
// Thin wrapper over the reusable MarkdownRenderer library. Tool-panel content
// (orientation guides, architecture summaries) has no citations, so this just
// forwards text — code highlighting, copy buttons and Mermaid come for free.

function MdContent({ text }: { text: string }) {
  return <MarkdownRenderer content={text} theme="dark" />
}

// ── Flow trace — types ────────────────────────────────────────────────────────

interface TraceRaw {
  id: string; name: string; file: string; file_path: string; line: number
}
interface TraceEdge { from: string; to: string }
interface TraceResult {
  keyword: string; direction: string
  nodes: TraceRaw[]; edges: TraceEdge[]; roots: string[]; total: number
}
interface TreeNode extends TraceRaw {
  children: TreeNode[]
  isRoot: boolean
}

// ── File-extension colours ────────────────────────────────────────────────────

const EXT_COLOR: Record<string, string> = {
  py: '#3b82f6', ts: '#a78bfa', tsx: '#c4b5fd', js: '#f59e0b', jsx: '#fbbf24',
  go: '#10b981', java: '#ef4444', rs: '#f97316', rb: '#e11d48',
  kt: '#8b5cf6', cs: '#06b6d4', cpp: '#f97316', c: '#fb923c',
}
function extColor(file: string) {
  return EXT_COLOR[file.split('.').pop()?.toLowerCase() ?? ''] ?? '#71717a'
}

// ── Build tree from flat nodes + edges ────────────────────────────────────────

function buildTree(result: TraceResult): TreeNode[] {
  const nodeMap = new Map(result.nodes.map(n => [n.id, n]))
  const childMap = new Map<string, string[]>()
  for (const e of result.edges) {
    if (!childMap.has(e.from)) childMap.set(e.from, [])
    childMap.get(e.from)!.push(e.to)
  }
  const visited = new Set<string>()

  function toTree(id: string): TreeNode | null {
    if (visited.has(id)) return null
    visited.add(id)
    const raw = nodeMap.get(id)
    if (!raw) return null
    return {
      ...raw,
      isRoot: result.roots.includes(id),
      children: (childMap.get(id) ?? []).map(toTree).filter(Boolean) as TreeNode[],
    }
  }

  return result.roots.map(toTree).filter(Boolean) as TreeNode[]
}

// ── Single tree node ──────────────────────────────────────────────────────────

function FlowNode({
  node, depth, direction,
}: {
  node: TreeNode; depth: number; direction: string
}) {
  const [expanded, setExpanded] = useState(depth < 3)
  const { currentRepo } = useWorkspace()
  const hasChildren = node.children.length > 0
  const color = extColor(node.file)
  const fileName = node.file.split('/').pop() ?? node.file
  const isCallers = direction === 'callers'

  return (
    <div>
      {/* Node row */}
      <div
        className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
          node.isRoot
            ? 'bg-accent/10 border border-accent/25'
            : 'hover:bg-s2'
        }`}
        style={{ marginLeft: `${depth * 20}px` }}
        onClick={() => node.file && openGithubBlob(currentRepo, node.file, node.line || 1)}
      >
        {/* Expand toggle */}
        <button
          className={`w-4 h-4 flex-shrink-0 text-muted hover:text-white transition-colors ${!hasChildren ? 'opacity-0 pointer-events-none' : ''}`}
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Direction arrow */}
        {depth > 0 && (
          <span className="text-muted text-[10px] flex-shrink-0">
            {isCallers ? '←' : '→'}
          </span>
        )}

        {/* Function name */}
        <span className={`font-mono text-xs font-medium truncate flex-1 min-w-0 ${node.isRoot ? 'text-accent' : 'text-white'}`}>
          {node.name}
        </span>

        {/* File + line badge */}
        <span
          className="text-[10px] font-mono flex-shrink-0 opacity-70"
          style={{ color }}
        >
          {fileName}
          {node.line > 0 && <span className="text-muted">:{node.line}</span>}
        </span>

        {/* Children count pill when collapsed */}
        {hasChildren && !expanded && (
          <span className="text-[9px] text-muted bg-s2 border border-border px-1 py-0.5 rounded-full flex-shrink-0">
            +{node.children.length}
          </span>
        )}

        {/* Open in explorer icon */}
        <ExternalLink
          size={10}
          className="flex-shrink-0 text-muted opacity-0 group-hover:opacity-60 transition-opacity"
        />
      </div>

      {/* Children — left border tree line */}
      {expanded && hasChildren && (
        <div
          className="border-l border-border/50"
          style={{ marginLeft: `${depth * 20 + 12}px` }}
        >
          {node.children.map(child => (
            <FlowNode key={child.id} node={child} depth={depth + 1} direction={direction} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Full trace panel ──────────────────────────────────────────────────────────

function TraceView({ repoReady }: { repoReady: boolean }) {
  const [keyword, setKeyword]     = useState('')
  const [direction, setDirection] = useState<'callees' | 'callers'>('callees')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<TraceResult | null>(null)
  const [error, setError]         = useState('')
  const [tree, setTree]           = useState<TreeNode[]>([])

  const search = useCallback(async () => {
    if (!keyword.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const data = await api.trace(keyword.trim(), direction)
      setResult(data)
      setTree(buildTree(data))
    } catch {
      setError('Trace failed. Make sure the repository has been analyzed.')
    } finally {
      setLoading(false)
    }
  }, [keyword, direction])

  const uniqueFiles = result
    ? new Set(result.nodes.map(n => n.file.split('/').pop())).size
    : 0

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text" value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="function name or keyword…"
          disabled={!repoReady}
          className="flex-1 bg-s2 border border-border text-white placeholder-muted rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent disabled:opacity-50 font-mono"
        />
        <button
          onClick={search}
          disabled={!repoReady || loading || !keyword.trim()}
          className="bg-accent hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-3 py-2 transition-colors flex-shrink-0"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Direction toggle */}
      <div className="flex gap-1.5">
        {(['callees', 'callers'] as const).map(dir => (
          <button
            key={dir}
            onClick={() => setDirection(dir)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
              direction === dir
                ? 'bg-accent/15 text-accent border-accent/40'
                : 'bg-transparent text-muted border-border hover:border-muted hover:text-white'
            }`}
          >
            {dir === 'callees'
              ? <><ArrowDown size={10} /> Callees</>
              : <><ArrowUp size={10} /> Callers</>}
          </button>
        ))}
        <span className="text-[10px] text-muted self-center ml-1">
          {direction === 'callees' ? 'what does it call?' : 'who calls it?'}
        </span>
      </div>

      {/* Errors / empty */}
      {error && <p className="text-xs text-danger">{error}</p>}
      {result && result.total === 0 && (
        <div className="bg-s2 border border-border rounded-lg p-4 text-center">
          <p className="text-xs text-muted">
            No {direction} found for <span className="font-mono text-white">&ldquo;{keyword}&rdquo;</span>
          </p>
          <p className="text-[10px] text-muted mt-1">
            Try a partial name, or switch direction.
          </p>
        </div>
      )}

      {/* Stats bar */}
      {result && result.total > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-s2/50 border border-border rounded-lg">
          <span className="text-[11px] text-white font-medium">{result.total} functions</span>
          <span className="text-muted text-[10px]">·</span>
          <span className="text-[11px] text-muted">{uniqueFiles} files</span>
          <span className="text-muted text-[10px]">·</span>
          <span className="text-[11px] text-muted font-mono">{result.keyword}</span>
          <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${
            direction === 'callees'
              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          }`}>
            {direction}
          </span>
        </div>
      )}

      {/* Tree */}
      {tree.length > 0 && (
        <div className="space-y-0.5 pb-2">
          {tree.map(root => (
            <FlowNode key={root.id} node={root} depth={0} direction={direction} />
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
          <p className="text-xs text-muted">Tracing call graph…</p>
        </div>
      )}
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
  { id: 'onboarding',   label: 'Onboarding Guide',    icon: BookOpen,   description: 'How to run locally, prerequisites, and key files for new contributors', color: 'text-emerald-400' },
  { id: 'architecture', label: 'Architecture Summary', icon: Code2,      description: 'AI-generated overview of layers, patterns, and design decisions',       color: 'text-blue-400'   },
  { id: 'trace',        label: 'Flow Tracer',          icon: GitBranch,  description: 'Trace call chains and execution paths for any function or keyword',      color: 'text-pink-400'   },
  { id: 'deadcode',     label: 'Dead Code Finder',     icon: Bug,        description: 'Functions with no incoming calls — potential dead code to remove',       color: 'text-red-400'    },
  { id: 'testcoverage', label: 'Test Coverage',        icon: TestTube2,  description: 'Production functions with no corresponding test coverage',               color: 'text-orange-400' },
]

// ── Onboarding content ────────────────────────────────────────────────────────

function OnboardingContent({ data }: { data: unknown }) {
  const d = data as { guide: string }
  return (
    <div className="space-y-4">
      {d.guide && <MdContent text={d.guide} />}
    </div>
  )
}

// ── Save-to-note (copy to clipboard) ──────────────────────────────────────────

function SaveToNote({ getMarkdown }: { getMarkdown: () => string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getMarkdown())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable */ }
  }
  return (
    <button
      onClick={copy}
      className="w-full flex items-center justify-center gap-2 border border-border hover:border-muted text-muted hover:text-white rounded-full py-2.5 text-xs font-medium transition-colors"
    >
      {copied ? <><Check className="w-3.5 h-3.5 text-success" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Save to note</>}
    </button>
  )
}

// ── Dead code view ────────────────────────────────────────────────────────────

interface DeadCodeResult {
  total: number
  symbols: { symbol: string; file: string; rel_path: string; line: number; callers: number }[]
  message: string
}

function DeadCodeView({ data }: { data: unknown }) {
  const d = data as DeadCodeResult
  const { currentRepo } = useWorkspace()

  const markdown = () =>
    `**Dead code — ${d.total} symbol${d.total === 1 ? '' : 's'} with zero incoming calls**\n\n` +
    d.symbols.map(s => `- \`${s.file}\` — ${s.symbol}() · ${s.callers} callers`).join('\n')

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted leading-relaxed">{d.message}</p>

      {d.symbols.map((s, i) => (
        <button
          key={i}
          onClick={() => openGithubBlob(currentRepo, s.rel_path, s.line || 1)}
          title={`Open ${s.rel_path}:${s.line} on GitHub`}
          className="w-full flex items-center gap-3 bg-s2/60 hover:bg-s2 border border-border rounded-xl px-4 py-3 text-left transition-colors"
        >
          <span className="text-xs font-mono text-red-400 flex-shrink-0">{s.file}</span>
          <span className="text-xs font-mono text-zinc-300 truncate">
            {s.symbol}()
            <span className="text-muted"> · {s.callers} callers</span>
          </span>
        </button>
      ))}

      {d.total > 0 && <SaveToNote getMarkdown={markdown} />}
    </div>
  )
}

// ── Test coverage view ────────────────────────────────────────────────────────

interface CoverageResult {
  total: number
  untested: number
  functions: { name: string; file: string; rel_path: string; line: number; coverage: number; tested: boolean }[]
  message: string
}

function coverageColor(pct: number): string {
  if (pct === 0)  return 'text-red-400'
  if (pct < 50)   return 'text-orange-400'
  if (pct < 80)   return 'text-yellow-400'
  return 'text-emerald-400'
}

function TestCoverageView({ data }: { data: unknown }) {
  const d = data as CoverageResult
  const { currentRepo } = useWorkspace()

  const markdown = () =>
    `**Test coverage (graph-estimated) — ${d.untested} of ${d.total} hot functions untested**\n\n` +
    d.functions.map(f => `- ${f.name} — ${f.coverage}%${f.coverage === 0 ? ' · no tests' : f.tested ? ' ✓' : ''}`).join('\n')

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted leading-relaxed">{d.message}</p>

      {d.functions.map((f, i) => (
        <button
          key={i}
          onClick={() => openGithubBlob(currentRepo, f.rel_path, f.line || 1)}
          title={`Open ${f.rel_path}:${f.line} on GitHub`}
          className="w-full flex items-center gap-3 bg-s2/60 hover:bg-s2 border border-border rounded-xl px-4 py-3 text-left transition-colors"
        >
          <span className="text-xs font-mono text-yellow-300/90 truncate flex-1 min-w-0">{f.name}</span>
          <span className={`text-xs font-mono flex-shrink-0 ${coverageColor(f.coverage)}`}>
            {f.coverage}%
            {f.coverage === 0
              ? <span className="text-muted"> · no tests</span>
              : f.tested && <Check className="inline w-3 h-3 ml-1 -mt-0.5" />}
          </span>
        </button>
      ))}

      {d.total > 0 && <SaveToNote getMarkdown={markdown} />}
    </div>
  )
}

// ── Detail view ───────────────────────────────────────────────────────────────

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

  return (
    <div className="h-full flex flex-col">
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
            className="flex items-center gap-1.5 bg-accent hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
          >
            {result?.loading
              ? <><Loader2 className="w-3 h-3 animate-spin" /> {result.streaming ? 'Streaming…' : 'Generating…'}</>
              : <><Play className="w-3 h-3" /> {result?.data ? 'Regenerate' : 'Generate'}</>}
          </button>
        )}
      </div>

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
            {tool.id === 'onboarding'   && <OnboardingContent data={result.data} />}
            {tool.id === 'architecture' && <MdContent text={(result.data as { summary: string }).summary} />}
            {tool.id === 'deadcode'     && <DeadCodeView data={result.data} />}
            {tool.id === 'testcoverage' && <TestCoverageView data={result.data} />}
          </>
        )}
        {!result?.data && !result?.loading && !result?.error && tool.id !== 'trace' && repoReady && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-s2 border border-border flex items-center justify-center">
              <Icon className={`w-5 h-5 ${tool.color}`} />
            </div>
            <p className="text-xs text-muted">Click Generate to analyse the repository.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Card grid ─────────────────────────────────────────────────────────────────

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
              <div className="w-8 h-8 rounded-lg bg-s2 border border-border flex items-center justify-center flex-shrink-0 group-hover:border-muted transition-colors">
                {isLoading
                  ? <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  : <Icon className={`w-4 h-4 ${tool.color}`} />}
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
  const toolResults = store.toolResults as Partial<Record<ToolTab, ToolResult>>
  const currentRepo = store.currentRepo
  const { setToolResult } = store
  const [openTool, setOpenTool] = useState<ToolTab | null>(null)
  const repoReady = !!currentRepo

  const activeTool = TOOLS.find(t => t.id === openTool)

  const generate = async (tab: ToolTab) => {
    setToolResult(tab, { loading: true, data: null, streaming: true })

    if (tab === 'architecture') {
      let accumulated = ''
      await api.architectureStream(
        (token) => {
          accumulated += token
          setToolResult('architecture', { loading: true, data: { summary: accumulated }, streaming: true })
        },
        () => { setToolResult('architecture', { loading: false, data: { summary: accumulated }, streaming: false }) },
        (err) => { setToolResult('architecture', { loading: false, data: null, error: err, streaming: false }) },
      )
      return
    }

    if (tab === 'onboarding') {
      let guide = ''
      let entryPoints: { file: string; reasons: string[] }[] = []
      await api.onboardingStream(
        (eps) => { entryPoints = eps },
        (token) => {
          guide += token
          setToolResult('onboarding', { loading: true, data: { guide, entry_points: entryPoints }, streaming: true })
        },
        () => { setToolResult('onboarding', { loading: false, data: { guide, entry_points: entryPoints }, streaming: false }) },
        (err) => { setToolResult('onboarding', { loading: false, data: null, error: err, streaming: false }) },
      )
      return
    }

    try {
      let data: unknown
      switch (tab) {
        case 'deadcode':     data = await api.deadCode(currentRepo?.repoId); break
        case 'testcoverage': data = await api.testCoverage(currentRepo?.repoId); break
        default:             data = null
      }
      setToolResult(tab, { loading: false, data, streaming: false })
    } catch (e: unknown) {
      setToolResult(tab, { loading: false, data: null, error: e instanceof Error ? e.message : 'Failed', streaming: false })
    }
  }

  return (
    <aside className="h-full flex flex-col border-l border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
        <Sparkles className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold text-white">Tools</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
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
            <CardGrid toolResults={toolResults} repoReady={repoReady} onOpen={tab => setOpenTool(tab)} />
          </div>
        )}
      </div>
    </aside>
  )
}
