'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import {
  BookOpen, Code2, GitBranch,
  Loader2, AlertCircle, Search, ChevronLeft,
  Sparkles, Play, Bug, TestTube2, ChevronDown, ChevronRight,
  ExternalLink, ArrowDown, ArrowUp, Copy, Check,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useWorkspace, ToolTab, ToolResult } from '@/store/workspace'

// ── Mermaid diagram ────────────────────────────────────────────────────────────

function MermaidDiagram({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const idRef = useRef(`mermaid-rp-${Math.random().toString(36).slice(2)}`)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!ref.current || !content.trim()) return
    import('mermaid').then(m => {
      m.default.initialize({
        startOnLoad: false, theme: 'dark',
        themeVariables: {
          background: '#212121', primaryColor: '#2f2f2f',
          primaryTextColor: '#ececec', lineColor: '#60a5fa',
          nodeBorder: '#3d3d3d', clusterBkg: '#2f2f2f',
        },
      })
      m.default.render(idRef.current, content)
        .then(({ svg }) => { if (ref.current) ref.current.innerHTML = svg })
        .catch(() => setError(true))
    }).catch(() => setError(true))
  }, [content])

  if (error) {
    return (
      <pre className="bg-bg border border-border rounded-lg p-3 text-xs text-zinc-400 overflow-x-auto whitespace-pre-wrap my-3">
        {content}
      </pre>
    )
  }
  return (
    <div
      ref={ref}
      className="my-3 p-4 bg-bg border border-border rounded-lg overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
    />
  )
}

// ── Code block with copy button ────────────────────────────────────────────────

function CodeBlock({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  const copy = () => {
    navigator.clipboard.writeText(preRef.current?.innerText ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const codeEl = Array.isArray(children)
    ? (children as React.ReactElement[]).find(c => c && typeof c === 'object' && 'props' in c)
    : children as React.ReactElement
  const className = (codeEl as React.ReactElement | null)?.props?.className as string | undefined
  const lang = className?.split(' ').find(c => c.startsWith('language-'))?.replace('language-', '')

  if (lang === 'mermaid') {
    const raw = (codeEl as React.ReactElement | null)?.props?.children
    return <MermaidDiagram content={typeof raw === 'string' ? raw : String(raw ?? '')} />
  }

  return (
    <div className="relative my-3 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between bg-s2 px-3 py-1.5 border-b border-border">
        <span className="text-[10px] text-muted font-mono uppercase tracking-wide">{lang || 'code'}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[10px] text-muted hover:text-white transition-colors"
        >
          {copied
            ? <><Check className="w-3 h-3 text-success" /><span>Copied</span></>
            : <><Copy className="w-3 h-3" /><span>Copy</span></>}
        </button>
      </div>
      <pre ref={preRef} {...props} className="!m-0 !rounded-none !border-0 overflow-x-auto">
        {children}
      </pre>
    </div>
  )
}

// ── Shared markdown renderer ───────────────────────────────────────────────────

function MdContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      className="prose prose-invert prose-sm max-w-none
        prose-headings:text-white prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
        prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:my-1.5
        prose-li:text-zinc-300 prose-li:my-0.5
        prose-code:text-accent prose-code:bg-s2 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-0 prose-pre:border-0
        prose-strong:text-white prose-a:text-accent prose-a:no-underline hover:prose-a:underline
        prose-blockquote:border-accent/40 prose-blockquote:text-zinc-400"
      components={{ pre: (props) => <CodeBlock {...props as React.HTMLAttributes<HTMLPreElement>} /> }}
    >
      {text}
    </ReactMarkdown>
  )
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
  const { openCodeViewer } = useWorkspace()
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
        onClick={() => node.file_path && openCodeViewer(node.file_path, node.line || 1)}
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
  const d = data as { guide: string; entry_points: { file: string; reasons: string[] }[] }
  return (
    <div className="space-y-4">
      {d.entry_points?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Entry Points</p>
          {d.entry_points.map((ep, i) => (
            <div key={i} className="bg-s2 border border-border rounded-lg p-3">
              <p className="text-xs font-mono text-accent truncate">{ep.file}</p>
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

// ── Dead code / Test coverage view ────────────────────────────────────────────

interface AnalysisResult {
  total: number
  by_file: { file: string; functions: { name: string; line: number }[] }[]
  message: string
}

function AnalysisView({ data }: { data: unknown }) {
  const d = data as AnalysisResult
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (file: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(file) ? next.delete(file) : next.add(file)
      return next
    })

  return (
    <div className="space-y-3">
      <div className={`rounded-lg p-3 border text-xs leading-relaxed ${
        d.total === 0
          ? 'bg-success/10 border-success/30 text-success'
          : 'bg-warning/10 border-warning/30 text-warning'
      }`}>
        {d.message}
      </div>
      {d.by_file?.map(({ file, functions }) => (
        <div key={file} className="bg-s2 border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(file)}
            className="w-full flex items-center gap-2 p-3 text-left hover:bg-s2/80 transition-colors"
          >
            {expanded.has(file)
              ? <ChevronDown className="w-3 h-3 text-muted flex-shrink-0" />
              : <ChevronRight className="w-3 h-3 text-muted flex-shrink-0" />}
            <p className="text-xs font-mono text-zinc-300 truncate flex-1">{file}</p>
            <span className="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded-full flex-shrink-0">
              {functions.length}
            </span>
          </button>
          {expanded.has(file) && (
            <div className="border-t border-border px-4 pb-3 pt-2 space-y-1">
              {functions.map((fn, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono text-accent">{fn.name}</span>
                  {fn.line > 0 && <span className="text-[10px] text-muted">:{fn.line}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
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
            {(tool.id === 'deadcode' || tool.id === 'testcoverage') && <AnalysisView data={result.data} />}
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
