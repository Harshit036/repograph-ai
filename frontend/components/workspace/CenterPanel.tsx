'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import {
  Send, Loader2, FileCode2, ChevronRight, Sparkles, AlertCircle, Trash2,
  Copy, Check, Zap, FolderOpen, MessageSquare, Brain, ChevronDown, ChevronUp,
} from 'lucide-react'
import { api, ChatMessage } from '@/lib/api'
import { useWorkspace, Message, CenterTab } from '@/store/workspace'

const CodeExplorer = dynamic(() => import('./CodeExplorer'), { ssr: false })

let msgId = 0
const nextId = () => String(++msgId)

// ── Mermaid diagram ────────────────────────────────────────────────────────────

function MermaidDiagram({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!ref.current || !content.trim()) return
    import('mermaid').then(m => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'dark',
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

// ── Code block with header + copy button ──────────────────────────────────────

function CodeBlock({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  const copy = () => {
    navigator.clipboard.writeText(preRef.current?.innerText ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Extract language from code child's className (rehype-highlight sets "language-X hljs")
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

// ── Thinking / pipeline steps block ───────────────────────────────────────────

function ThinkingBlock({ steps, streaming }: { steps: string[]; streaming?: boolean }) {
  const [open, setOpen] = useState(true)

  // Auto-collapse when streaming finishes
  useEffect(() => {
    if (!streaming) setOpen(false)
  }, [streaming])

  return (
    <div className="w-full bg-s2/40 rounded-lg border border-border/50 overflow-hidden mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-s2/60 transition-colors"
      >
        <Brain className="w-3.5 h-3.5 text-muted flex-shrink-0" />
        <span className="text-xs text-muted flex-1">
          {streaming ? 'Thinking…' : `Searched codebase · ${steps.length} steps`}
        </span>
        {streaming && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />}
        {!streaming && (open ? <ChevronUp className="w-3 h-3 text-muted" /> : <ChevronDown className="w-3 h-3 text-muted" />)}
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-1">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-zinc-500">
              <span className="font-mono text-muted/60 flex-shrink-0 mt-px select-none">{i + 1}.</span>
              <span className="leading-relaxed">{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Markdown renderer ──────────────────────────────────────────────────────────

type CitationShape = {
  source_id: number; file: string; file_path: string
  start_line: number; end_line: number; preview: string; chunk_text?: string
}

function preprocessCitations(text: string): string {
  // Turn [Source N] into a markdown link so ReactMarkdown renders it as an <a>
  return text.replace(/\[Source (\d+)\]/g, '[Source $1](#source-$1)')
}

function MdContent({
  text,
  size = 'sm',
  citations,
}: {
  text: string
  size?: 'sm' | 'xs'
  citations?: CitationShape[]
}) {
  const { openCodeViewer, currentRepo } = useWorkspace()
  const prose = size === 'sm' ? 'prose-sm' : 'prose-xs'
  const processed = citations?.length ? preprocessCitations(text) : text

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      className={`prose prose-invert ${prose} max-w-none
        prose-headings:text-white prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
        prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:my-1.5
        prose-li:text-zinc-300 prose-li:my-0.5
        prose-code:text-accent prose-code:bg-s2 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-0 prose-pre:border-0
        prose-strong:text-white prose-a:text-accent prose-a:no-underline hover:prose-a:underline
        prose-blockquote:border-accent/40 prose-blockquote:text-zinc-400
        prose-table:text-xs prose-th:text-white prose-td:text-zinc-300`}
      components={{
        // Citation inline link chips
        a: ({ href, children }) => {
          if (href?.startsWith('#source-')) {
            const id = parseInt(href.replace('#source-', ''), 10)
            const c = citations?.find(x => x.source_id === id)
            return (
              <button
                onClick={() => c?.file_path && openCodeViewer(c.file_path, c.start_line || 1, currentRepo?.repoId)}
                title={c ? `${c.file}:${c.start_line}` : `Source ${id}`}
                className="inline-flex items-center gap-0.5 bg-accent/20 text-accent text-[11px] px-1.5 py-0.5 rounded font-mono hover:bg-accent/40 transition-colors cursor-pointer leading-none mx-0.5 align-baseline"
              >
                {children}
              </button>
            )
          }
          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        },
        // Code blocks with copy button + Mermaid
        pre: (props) => <CodeBlock {...props as React.HTMLAttributes<HTMLPreElement>} />,
      }}
    >
      {processed}
    </ReactMarkdown>
  )
}

// ── Citation card — hover preview + click to navigate ─────────────────────────

function CitationCard({ c }: { c: CitationShape }) {
  const { openCodeViewer, currentRepo } = useWorkspace()
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)
  const code = c.chunk_text || c.preview

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const navigate = () => {
    if (c.file_path) openCodeViewer(c.file_path, c.start_line || 1, currentRepo?.repoId)
  }

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        onClick={navigate}
        className="w-full flex items-center gap-2 px-3 py-2 bg-s2/60 rounded-lg text-left hover:bg-s2 transition-colors group"
      >
        <span className="font-mono bg-accent/20 text-accent px-1.5 py-0.5 rounded text-xs flex-shrink-0">[{c.source_id}]</span>
        <FileCode2 className="w-3 h-3 text-muted flex-shrink-0" />
        <span className="text-zinc-400 font-mono text-xs truncate flex-1">{c.file}</span>
        {c.start_line > 0 && (
          <span className="text-[10px] text-muted flex-shrink-0">:{c.start_line}</span>
        )}
        <ChevronRight className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </button>

      {hovered && code && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-s2 border-b border-border">
            <span className="text-[10px] text-muted font-mono truncate flex-1">
              {c.file_path ? c.file_path.split('/').slice(-3).join('/') : c.file}
              {c.start_line > 0 && ` :${c.start_line}`}
            </span>
            <button onClick={copy} className="ml-2 text-muted hover:text-white transition-colors flex-shrink-0">
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <pre className="px-3 py-2 text-green-400 font-mono overflow-x-auto whitespace-pre-wrap text-[10px] leading-relaxed max-h-48 overflow-y-auto">
            {code.slice(0, 800)}{code.length > 800 ? '\n…' : ''}
          </pre>
          <div className="px-3 py-1.5 bg-zinc-900 border-t border-border">
            <span className="text-[10px] text-accent">Click to open in Code Explorer →</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const { avatarUrl, githubLogin } = useWorkspace()
  const [memOpen, setMemOpen] = useState(false)
  const facts = msg.memory?.discovered_facts ?? []

  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'items-start'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-7 h-7 rounded-full overflow-hidden bg-s2 flex items-center justify-center">
            {avatarUrl
              ? <img src={avatarUrl} alt={githubLogin} className="w-7 h-7 object-cover" />
              : <span className="text-xs font-semibold text-zinc-300">{(githubLogin || 'U').charAt(0).toUpperCase()}</span>}
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 space-y-3 ${isUser ? 'flex flex-col items-end' : ''}`}>

        {/* Thinking steps — shown before content during streaming */}
        {!isUser && msg.steps && msg.steps.length > 0 && (
          <ThinkingBlock steps={msg.steps} streaming={msg.streaming} />
        )}

        {/* Bubble or plain text */}
        <div className={
          isUser
            ? 'bg-s2 rounded-[20px] px-5 py-3.5 max-w-[82%]'
            : msg.error
            ? 'bg-danger/10 border border-danger/20 rounded-xl px-4 py-3 max-w-full'
            : 'max-w-full'
        }>
          {isUser
            ? <p className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            : msg.streaming
            ? <div className="flex items-start gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent flex-shrink-0 mt-0.5" />
                <MdContent text={msg.content || '…'} citations={msg.citations as CitationShape[]} />
              </div>
            : <MdContent text={msg.content} citations={msg.citations as CitationShape[]} />
          }
        </div>

        {/* Citations */}
        {msg.citations && msg.citations.length > 0 && (
          <div className="w-full space-y-1.5">
            <p className="text-[11px] text-muted">{msg.citations.length} source{msg.citations.length > 1 ? 's' : ''}</p>
            {msg.citations.map(c => <CitationCard key={c.source_id} c={c as CitationShape} />)}
          </div>
        )}

        {/* Agent reasoning steps */}
        {msg.actions && msg.actions.length > 0 && (
          <div className="w-full space-y-1">
            <p className="text-[11px] text-muted">Reasoning · {msg.actions.length} steps</p>
            {msg.actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-zinc-400 bg-s2/60 rounded-lg px-3 py-2">
                <span className="text-muted font-mono flex-shrink-0 mt-px">{i + 1}.</span>
                <span className="leading-relaxed">{a}</span>
              </div>
            ))}
          </div>
        )}

        {/* Agent memory — collapsible */}
        {facts.length > 0 && (
          <div className="w-full bg-s2/40 rounded-lg border border-border/50 overflow-hidden">
            <button
              onClick={() => setMemOpen(v => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-s2/60 transition-colors"
            >
              <Brain className="w-3.5 h-3.5 text-accent/70 flex-shrink-0" />
              <span className="text-xs text-muted flex-1">Memory captured · {facts.length} fact{facts.length > 1 ? 's' : ''}</span>
              {memOpen ? <ChevronUp className="w-3 h-3 text-muted" /> : <ChevronDown className="w-3 h-3 text-muted" />}
            </button>
            {memOpen && (
              <div className="px-3 pb-2 space-y-1">
                {facts.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                    <span className="text-accent/60 flex-shrink-0 mt-px">•</span>
                    <span className="leading-relaxed">{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function CenterPanel() {
  const {
    messages, deepMode, currentRepo, setDeepMode,
    addMessage, updateMessage, clearMessages,
    contextRepos, currentSessionId, setCurrentSessionId,
    addSession, updateSessionTitle, prDiff,
    centerTab, setCenterTab,
  } = useWorkspace()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sessionInitRef = useRef<string | null>(null)
  const stepsRef = useRef<string[]>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildHistory = useCallback((): ChatMessage[] =>
    messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
    [messages]
  )

  const ensureSession = async (firstMessage: string): Promise<string | null> => {
    if (currentSessionId) return currentSessionId
    if (sessionInitRef.current) return sessionInitRef.current
    try {
      const title = firstMessage.slice(0, 60)
      const repoIds = contextRepos.length > 0 ? contextRepos : []
      const sess = await api.sessions.create(title, repoIds)
      sessionInitRef.current = sess.id
      setCurrentSessionId(sess.id)
      addSession(sess)
      return sess.id
    } catch { return null }
  }

  const saveMessage = async (sessionId: string, role: string, content: string,
                              citations?: unknown, actions?: string[]) => {
    try {
      await api.sessions.saveMessage(sessionId, role, content,
        citations as Parameters<typeof api.sessions.saveMessage>[3],
        actions ?? null)
      if (role === 'assistant' && messages.filter(m => m.role === 'assistant').length === 0) {
        const snippet = content.slice(0, 60)
        updateSessionTitle(sessionId, snippet)
        api.sessions.rename(sessionId, snippet).catch(() => {})
      }
    } catch { /* non-blocking */ }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)
    const userMsgId = nextId()
    addMessage({ id: userMsgId, role: 'user', content: text })
    const history = buildHistory()
    const assistantId = nextId()
    const repoIds = contextRepos.length > 0 ? contextRepos : []

    const enrichedText = prDiff
      ? `${text}\n\n[PR Context: ${prDiff.title} (${prDiff.repo} #${prDiff.number}) — ${prDiff.files.length} files changed]`
      : text

    const sessionId = await ensureSession(text)
    if (sessionId) saveMessage(sessionId, 'user', text)

    try {
      if (!deepMode) {
        stepsRef.current = []
        addMessage({ id: assistantId, role: 'assistant', content: '', streaming: true, steps: [] })
        let accumulated = ''
        await api.ragQueryStream(
          enrichedText, history, repoIds,
          (token) => {
            accumulated += token
            updateMessage(assistantId, { content: accumulated, streaming: true })
          },
          (citations) => {
            updateMessage(assistantId, { streaming: false, citations })
            if (sessionId) saveMessage(sessionId, 'assistant', accumulated, citations)
          },
          (err) => { updateMessage(assistantId, { content: err, error: true, streaming: false }) },
          (step) => {
            stepsRef.current = [...stepsRef.current, step]
            updateMessage(assistantId, { steps: stepsRef.current })
          },
        )
      } else {
        addMessage({ id: assistantId, role: 'assistant', content: '', streaming: true })
        const data = await api.agentQuery(enrichedText, history)
        updateMessage(assistantId, { content: data.response, actions: data.actions, memory: data.memory, streaming: false })
        if (sessionId) saveMessage(sessionId, 'assistant', data.response, null, data.actions)
      }
    } catch {
      updateMessage(assistantId, { content: 'Request failed. Make sure a repo is ingested and the API is running.', error: true, streaming: false })
    } finally {
      setLoading(false)
      sessionInitRef.current = null
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const TABS: { id: CenterTab; icon: React.ElementType; label: string }[] = [
    { id: 'chat',     icon: MessageSquare, label: 'Chat'     },
    { id: 'explorer', icon: FolderOpen,    label: 'Explorer' },
  ]

  return (
    <div className="h-full flex flex-col min-w-0 overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border flex-shrink-0">
        <div className="flex">
          {TABS.map(t => {
            const Icon = t.icon
            const active = centerTab === t.id
            return (
              <button key={t.id} onClick={() => setCenterTab(t.id)}
                className={`flex items-center gap-1.5 px-5 py-3 text-xs font-medium border-b-2 transition-colors ${
                  active ? 'border-accent text-white' : 'border-transparent text-muted hover:text-zinc-300'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>
        {centerTab === 'chat' && messages.length > 0 && (
          <button onClick={clearMessages} className="ml-auto mr-4 text-muted hover:text-danger transition-colors p-1 rounded" title="Clear chat">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Code Explorer */}
      {centerTab === 'explorer' && (
        <div className="flex-1 overflow-hidden">
          <CodeExplorer />
        </div>
      )}

      {/* Chat panel — hidden (not unmounted) to preserve message state */}
      <div className={`flex-1 flex flex-col min-h-0 ${centerTab !== 'chat' ? 'hidden' : ''}`}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[740px] mx-auto px-6 py-8 space-y-8">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
                <div className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-zinc-200 font-medium text-base">
                    {currentRepo ? `Ask about ${currentRepo.url.split('/').slice(-1)[0]}` : 'RepoGraph AI'}
                  </p>
                  <p className="text-sm text-muted mt-1 leading-relaxed">
                    {currentRepo ? 'Ask anything about the codebase.' : 'Paste a GitHub URL in the left panel to get started.'}
                  </p>
                </div>
                {currentRepo && (
                  <div className="flex flex-wrap gap-2 justify-center pt-1">
                    {['How does this project work?', 'What are the main entry points?', 'Explain the architecture'].map(q => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); textareaRef.current?.focus() }}
                        className="text-xs text-zinc-400 border border-border hover:border-zinc-500 hover:text-zinc-200 bg-s2/50 rounded-full px-4 py-2 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 pb-6 pt-3">
          <div className="max-w-[740px] mx-auto">
            {!currentRepo && (
              <div className="flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-xl px-3 py-2 mb-3">
                <AlertCircle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                <p className="text-xs text-warning">Ingest a repository first using the left panel.</p>
              </div>
            )}
            <div className="bg-s2 rounded-2xl focus-within:ring-1 focus-within:ring-border transition-all">
              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={!currentRepo || loading}
                placeholder={currentRepo ? 'Ask about the codebase…' : 'Ingest a repo to start chatting…'}
                className="w-full bg-transparent text-zinc-100 placeholder-muted px-5 pt-4 pb-2 text-sm focus:outline-none resize-none disabled:opacity-50 leading-relaxed"
              />
              <div className="flex items-center justify-between px-3 pb-3 pt-1">
                <button
                  onClick={() => setDeepMode(!deepMode)}
                  title={deepMode ? 'Deep: multi-step reasoning' : 'Standard: fast semantic search'}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    deepMode
                      ? 'bg-accent/20 text-accent border border-accent/30'
                      : 'text-muted hover:text-zinc-300'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  Deep
                </button>
                <button
                  onClick={send}
                  disabled={!currentRepo || loading || !input.trim()}
                  className="flex items-center justify-center w-8 h-8 bg-white disabled:bg-white/20 disabled:cursor-not-allowed text-black disabled:text-white/40 rounded-full transition-all hover:bg-zinc-200"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-muted/60 mt-2">Enter to send · Shift+Enter for newline</p>
          </div>
        </div>
      </div>
    </div>
  )
}
