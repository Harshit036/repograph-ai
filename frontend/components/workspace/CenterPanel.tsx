'use client'
import { useRef, useEffect, useState } from 'react'
import { Send, Bot, MessageSquare, Loader2, FileCode2, ChevronDown, ChevronRight, Sparkles, AlertCircle, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useWorkspace, Message } from '@/store/workspace'

let msgId = 0
const nextId = () => String(++msgId)

function Spinner() {
  return <Loader2 className="w-4 h-4 animate-spin text-accent" />
}

function CitationCard({ c }: { c: { source_id: number; file: string; file_path: string; preview: string } }) {
  const [open, setOpen] = useState(false)
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
        <pre className="px-3 pb-3 text-green-400 font-mono overflow-x-auto whitespace-pre-wrap bg-bg border-t border-border text-[11px] leading-relaxed">
          {c.preview}
        </pre>
      )}
    </div>
  )
}

function renderMd(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-white mt-3 mb-1">{line.slice(4)}</h3>
    if (line.startsWith('## '))  return <h2 key={i} className="text-base font-semibold text-white mt-4 mb-1">{line.slice(3)}</h2>
    if (line.startsWith('# '))   return <h1 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>
    if (line.startsWith('- ') || line.startsWith('* '))
      return <li key={i} className="text-sm text-zinc-300 ml-4 list-disc mb-0.5">{line.slice(2)}</li>
    if (!line.trim()) return <div key={i} className="h-1.5" />
    const parts = line.split(/(`[^`]+`)/)
    return (
      <p key={i} className="text-sm text-zinc-300 leading-relaxed mb-0.5">
        {parts.map((p, j) =>
          p.startsWith('`') && p.endsWith('`')
            ? <code key={j} className="bg-s2 text-violet-400 px-1 rounded font-mono text-xs">{p.slice(1, -1)}</code>
            : p
        )}
      </p>
    )
  })
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isUser ? 'bg-accent/20' : 'bg-s2 border border-border'}`}>
        {isUser
          ? <span className="text-xs font-bold text-accent">U</span>
          : <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        }
      </div>
      <div className={`flex-1 max-w-[85%] space-y-2 ${isUser ? 'items-end flex flex-col' : ''}`}>
        <div className={`rounded-xl px-4 py-3 ${
          isUser
            ? 'bg-accent/20 border border-accent/30'
            : msg.error
            ? 'bg-danger/10 border border-danger/30'
            : 'bg-surface border border-border'
        }`}>
          {isUser
            ? <p className="text-sm text-white">{msg.content}</p>
            : <div className="space-y-1">{renderMd(msg.content)}</div>
          }
        </div>

        {/* Citations */}
        {msg.citations && msg.citations.length > 0 && (
          <div className="w-full space-y-1.5">
            <p className="text-[11px] text-muted font-medium">{msg.citations.length} source{msg.citations.length > 1 ? 's' : ''}</p>
            {msg.citations.map(c => <CitationCard key={c.source_id} c={c} />)}
          </div>
        )}

        {/* Agent steps */}
        {msg.actions && msg.actions.length > 0 && (
          <div className="w-full space-y-1">
            <p className="text-[11px] text-muted font-medium">Agent steps</p>
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

export default function CenterPanel() {
  const { messages, chatMode, currentRepo, setChatMode, addMessage, clearMessages } = useWorkspace()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)
    addMessage({ id: nextId(), role: 'user', content: text })

    try {
      if (chatMode === 'rag') {
        const data = await api.ragQuery(text)
        addMessage({ id: nextId(), role: 'assistant', content: data.response, citations: data.citations })
      } else {
        const data = await api.agentQuery(text)
        addMessage({ id: nextId(), role: 'assistant', content: data.response, actions: data.actions, memory: data.memory })
      }
    } catch {
      addMessage({ id: nextId(), role: 'assistant', content: 'Request failed. Make sure a repo is ingested and the API is running.', error: true })
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface/50 backdrop-blur-sm">
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
          {chatMode === 'agent' && (
            <span className="text-[11px] text-muted">Multi-step LangGraph reasoning</span>
          )}
          {chatMode === 'rag' && (
            <span className="text-[11px] text-muted">Semantic search + citations</span>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-muted hover:text-danger transition-colors p-1 rounded"
              title="Clear chat"
            >
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
                  ? `Repo indexed. Ask anything about ${currentRepo.url.split('/').slice(-1)[0]}.`
                  : 'Paste a GitHub URL in the left panel first, then ask anything about the code.'}
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
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-s2 border border-border flex items-center justify-center flex-shrink-0">
              <Spinner />
            </div>
            <div className="bg-surface border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-muted text-sm">
                <span>{chatMode === 'agent' ? 'Running LangGraph agent…' : 'Searching codebase…'}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-border bg-surface/50">
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
