'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Send, Bot, MessageSquare, Loader2, FileCode2, ChevronDown, ChevronRight, Sparkles, AlertCircle, Trash2, Copy, Check } from 'lucide-react'
import { api, ChatMessage } from '@/lib/api'
import { useWorkspace, Message } from '@/store/workspace'

let msgId = 0
const nextId = () => String(++msgId)

// ── Markdown renderer ──────────────────────────────────────────────────────────

function MdContent({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const prose = size === 'sm' ? 'prose-sm' : 'prose-xs'
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      className={`prose prose-invert ${prose} max-w-none
        prose-headings:text-white prose-headings:font-semibold
        prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:my-1
        prose-li:text-zinc-300 prose-li:my-0.5
        prose-code:text-violet-400 prose-code:bg-s2 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:font-mono
        prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:text-xs
        prose-strong:text-white prose-a:text-accent prose-blockquote:border-accent/40
        prose-table:text-xs prose-th:text-white prose-td:text-zinc-300`}
    >
      {text}
    </ReactMarkdown>
  )
}

// ── Citation card ──────────────────────────────────────────────────────────────

function CitationCard({ c }: { c: { source_id: number; file: string; file_path: string; preview: string; chunk_text?: string } }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const code = c.chunk_text || c.preview

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="bg-bg border border-border rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-s2/50 transition-colors"
      >
        <span className="font-mono bg-accent/20 text-accent px-1.5 py-0.5 rounded flex-shrink-0">[{c.source_id}]</span>
        <FileCode2 className="w-3 h-3 text-muted flex-shrink-0" />
        <span className="text-zinc-400 font-mono truncate flex-1">{c.file}</span>
        {open ? <ChevronDown className="w-3 h-3 text-muted" /> : <ChevronRight className="w-3 h-3 text-muted" />}
      </button>
      {open && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/50">
            <span className="text-[10px] text-muted font-mono truncate flex-1">{c.file_path || c.file}</span>
            <button onClick={copy} className="ml-2 text-muted hover:text-white transition-colors flex-shrink-0">
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <pre className="px-3 pb-3 text-green-400 font-mono overflow-x-auto whitespace-pre-wrap bg-zinc-950 text-[11px] leading-relaxed max-h-60">
            {code}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const { avatarUrl, githubLogin } = useWorkspace()

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden ${isUser ? 'bg-accent/20' : 'bg-s2 border border-border'}`}>
        {isUser
          ? avatarUrl
            ? <img src={avatarUrl} alt={githubLogin} className="w-7 h-7 object-cover" />
            : <span className="text-xs font-bold text-accent">{(githubLogin || 'U').charAt(0).toUpperCase()}</span>
          : <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        }
      </div>
      <div className={`flex-1 max-w-[88%] space-y-2 ${isUser ? 'items-end flex flex-col' : ''}`}>
        <div className={`rounded-xl px-4 py-3 ${
          isUser
            ? 'bg-accent/20 border border-accent/30'
            : msg.error
            ? 'bg-danger/10 border border-danger/30'
            : 'bg-surface border border-border'
        }`}>
          {isUser
            ? <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
            : msg.streaming
            ? <div className="flex items-center gap-2 text-muted text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                <MdContent text={msg.content || '…'} />
              </div>
            : <MdContent text={msg.content} />
          }
        </div>

        {msg.citations && msg.citations.length > 0 && (
          <div className="w-full space-y-1.5">
            <p className="text-[11px] text-muted font-medium">{msg.citations.length} source{msg.citations.length > 1 ? 's' : ''}</p>
            {msg.citations.map(c => <CitationCard key={c.source_id} c={c} />)}
          </div>
        )}

        {msg.actions && msg.actions.length > 0 && (
          <div className="w-full space-y-1">
            <p className="text-[11px] text-muted font-medium">Agent reasoning ({msg.actions.length} steps)</p>
            {msg.actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-zinc-400 bg-s2 border border-border rounded-lg px-3 py-2">
                <span className="text-muted font-mono flex-shrink-0">{i + 1}.</span>
                <span className="leading-relaxed">{a}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function CenterPanel() {
  const { messages, chatMode, currentRepo, setChatMode, addMessage, updateMessage, clearMessages } = useWorkspace()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildHistory = useCallback((): ChatMessage[] =>
    messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
    [messages]
  )

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)
    addMessage({ id: nextId(), role: 'user', content: text })
    const history = buildHistory()

    const assistantId = nextId()

    try {
      if (chatMode === 'rag') {
        // Add streaming placeholder
        addMessage({ id: assistantId, role: 'assistant', content: '', streaming: true })

        // Use a ref accumulator to avoid stale closure over `messages`
        let accumulated = ''
        await api.ragQueryStream(
          text,
          history,
          (token) => {
            accumulated += token
            updateMessage(assistantId, { content: accumulated, streaming: true })
          },
          (citations) => {
            updateMessage(assistantId, { streaming: false, citations })
          },
          (err) => {
            updateMessage(assistantId, { content: err, error: true, streaming: false })
          },
        )
      } else {
        addMessage({ id: assistantId, role: 'assistant', content: '', streaming: true })
        const data = await api.agentQuery(text, history)
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
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-1 bg-s2 rounded-lg p-1">
          <button
            onClick={() => setChatMode('rag')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              chatMode === 'rag' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-white'
            }`}
          >
            <MessageSquare className="w-3 h-3" /> RAG
          </button>
          <button
            onClick={() => setChatMode('agent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              chatMode === 'agent' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-white'
            }`}
          >
            <Bot className="w-3 h-3" /> Agent
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted hidden sm:block">
            {chatMode === 'agent' ? 'Multi-step LangGraph reasoning' : 'Semantic search + citations'}
          </span>
          {messages.length > 0 && (
            <button onClick={clearMessages} className="text-muted hover:text-danger transition-colors p-1 rounded" title="Clear chat">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 pb-10">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-white font-medium">Ask about your repository</p>
              <p className="text-sm text-muted mt-1 max-w-xs leading-relaxed">
                {currentRepo
                  ? `Indexed. Ask anything about ${currentRepo.url.split('/').slice(-1)[0]}.`
                  : 'Paste a GitHub URL in the left panel first.'}
              </p>
            </div>
            {currentRepo && (
              <div className="flex flex-wrap gap-2 justify-center">
                {['How does this project work?', 'What are the main entry points?', 'Explain the architecture'].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); textareaRef.current?.focus() }}
                    className="text-xs text-muted border border-border hover:border-accent/50 hover:text-white bg-s2 rounded-full px-3 py-1.5 transition-all"
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

      {/* Input */}
      <div className="px-5 py-4 border-t border-border bg-surface/50 flex-shrink-0">
        {!currentRepo && (
          <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
            <p className="text-xs text-warning">Ingest a repository first using the left panel.</p>
          </div>
        )}
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={!currentRepo || loading}
            placeholder={currentRepo ? 'Ask about the codebase… (Enter to send, Shift+Enter for newline)' : 'Ingest a repo to start chatting…'}
            className="flex-1 bg-s2 border border-border text-white placeholder-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors resize-none disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!currentRepo || loading || !input.trim()}
            className="flex items-center justify-center w-10 h-10 bg-accent hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
