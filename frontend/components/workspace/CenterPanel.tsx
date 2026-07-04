'use client'
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import type { Components } from 'react-markdown'
import {
  Send, Loader2, Sparkles, AlertCircle, Trash2,
  Zap, Brain, ChevronDown, ChevronUp,
} from 'lucide-react'
import { api, ChatMessage } from '@/lib/api'
import { useWorkspace, Message } from '@/store/workspace'
import { openGithubBlob } from '@/lib/github'
import { MarkdownRenderer } from '@/components/markdown'
import type { MarkdownFeatures } from '@/types/markdown'

// Stable (module-scope) feature set — streaming-optimised for token-by-token chat.
const CHAT_FEATURES: MarkdownFeatures = { streaming: true }

let msgId = 0
const nextId = () => String(++msgId)

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
  source_id: number; file: string; file_path: string; rel_path?: string
  start_line: number; end_line: number; preview: string; chunk_text?: string
}

function preprocessCitations(text: string): string {
  // Turn [Source N] into a markdown link so ReactMarkdown renders it as an <a>
  return text.replace(/\[Source (\d+)\]/g, '[Source $1](#source-$1)')
}

function MdContent({
  text,
  citations,
}: {
  text: string
  citations?: CitationShape[]
}) {
  const { currentRepo } = useWorkspace()
  const processed = citations?.length ? preprocessCitations(text) : text

  // Inject citation-chip behaviour via the renderer's `components` override.
  // Clicking a citation opens the source file on GitHub (DeepWiki-style).
  const components = useMemo<Partial<Components>>(
    () => ({
      a: ({ href, children }) => {
        if (typeof href === 'string' && href.startsWith('#source-')) {
          const id = parseInt(href.replace('#source-', ''), 10)
          const c = citations?.find(x => x.source_id === id)
          return (
            <button
              onClick={() => c && openGithubBlob(currentRepo, c.rel_path || c.file_path, c.start_line || 1)}
              title={c ? `Open ${c.file}:${c.start_line} on GitHub` : `Source ${id}`}
              className="inline-flex items-center gap-0.5 bg-accent/20 text-accent text-[11px] px-1.5 py-0.5 rounded font-mono hover:bg-accent/40 transition-colors cursor-pointer leading-none mx-0.5 align-baseline"
            >
              {children}
            </button>
          )
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
            {children}
          </a>
        )
      },
    }),
    [citations, currentRepo],
  )

  return (
    <MarkdownRenderer
      content={processed}
      theme="dark"
      features={CHAT_FEATURES}
      components={components}
    />
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

        {/* Citations render inline as [Source N] chips — clicking opens the file on GitHub. */}

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
    addMessage, updateMessage, clearMessages, prDiff,
  } = useWorkspace()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stepsRef = useRef<string[]>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Conversation memory: the last 8 messages are threaded into every request so
  // the model remembers the ongoing conversation (nothing is persisted server-side).
  const buildHistory = useCallback((): ChatMessage[] =>
    messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
    [messages]
  )

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)
    const userMsgId = nextId()
    addMessage({ id: userMsgId, role: 'user', content: text })
    const history = buildHistory()
    const assistantId = nextId()

    const enrichedText = prDiff
      ? `${text}\n\n[PR Context: ${prDiff.title} (${prDiff.repo} #${prDiff.number}) — ${prDiff.files.length} files changed]`
      : text

    try {
      if (!deepMode) {
        stepsRef.current = []
        addMessage({ id: assistantId, role: 'assistant', content: '', streaming: true, steps: [] })
        let accumulated = ''
        await api.ragQueryStream(
          enrichedText, history, [],
          (token) => {
            accumulated += token
            updateMessage(assistantId, { content: accumulated, streaming: true })
          },
          (citations) => {
            updateMessage(assistantId, { citations })
          },
          (err) => { updateMessage(assistantId, { content: err, error: true, streaming: false }) },
          (step) => {
            stepsRef.current = [...stepsRef.current, step]
            updateMessage(assistantId, { steps: stepsRef.current })
          },
          () => { updateMessage(assistantId, { streaming: false }) },
        )
      } else {
        addMessage({ id: assistantId, role: 'assistant', content: '', streaming: true })
        const data = await api.agentQuery(enrichedText, history)
        updateMessage(assistantId, { content: data.response, actions: data.actions, memory: data.memory, streaming: false })
      }
    } catch {
      updateMessage(assistantId, { content: 'Request failed. Make sure a repo is ingested and the API is running.', error: true, streaming: false })
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="h-full flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center border-b border-border flex-shrink-0 px-5 py-3">
        <span className="text-sm font-semibold text-white">Chat</span>
        {messages.length > 0 && (
          <button onClick={clearMessages} className="ml-auto text-muted hover:text-danger transition-colors p-1 rounded" title="Clear chat">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col min-h-0">
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
