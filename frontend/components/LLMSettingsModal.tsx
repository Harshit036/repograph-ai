'use client'
import { useState } from 'react'
import { X, Settings, ChevronDown } from 'lucide-react'
import { useWorkspace } from '@/store/workspace'

const PROVIDERS = [
  { id: 'groq',      label: 'Groq',      hint: 'Free tier — fast inference',     models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  { id: 'openai',    label: 'OpenAI',    hint: 'GPT models',                      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'] },
  { id: 'anthropic', label: 'Anthropic', hint: 'Claude models',                   models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7'] },
  { id: 'ollama',    label: 'Ollama',    hint: 'Local — requires Ollama running', models: ['qwen2.5-coder:7b', 'llama3.2', 'deepseek-coder-v2'] },
]

interface Props {
  onClose: () => void
}

export default function LLMSettingsModal({ onClose }: Props) {
  const { llmConfig, setLLMConfig } = useWorkspace()
  const [local, setLocal] = useState({ ...llmConfig })
  const [showKey, setShowKey] = useState(false)

  const selectedProvider = PROVIDERS.find(p => p.id === local.provider) ?? PROVIDERS[0]

  const save = () => {
    setLLMConfig(local)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-accent" />
            <span className="font-semibold text-white text-sm">LLM Settings</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Provider */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setLocal(l => ({ ...l, provider: p.id, model: p.models[0] }))}
                  className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all ${
                    local.provider === p.id
                      ? 'border-accent bg-accent/10 text-white'
                      : 'border-border bg-s2 text-muted hover:border-muted'
                  }`}
                >
                  <span className="text-sm font-medium">{p.label}</span>
                  <span className="text-xs mt-0.5 opacity-70">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">Model</label>
            <div className="relative">
              <select
                value={local.model}
                onChange={e => setLocal(l => ({ ...l, model: e.target.value }))}
                className="w-full bg-s2 border border-border text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent appearance-none pr-8"
              >
                {selectedProvider.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value={local.model}>{local.model}</option>
              </select>
              <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <input
              type="text"
              value={local.model}
              onChange={e => setLocal(l => ({ ...l, model: e.target.value }))}
              placeholder="Or type a custom model name"
              className="w-full bg-s2 border border-border text-white placeholder-muted rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-accent font-mono"
            />
          </div>

          {/* API Key */}
          {local.provider !== 'ollama' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={local.apiKey}
                  onChange={e => setLocal(l => ({ ...l, apiKey: e.target.value }))}
                  placeholder={`${selectedProvider.label} API key`}
                  className="w-full bg-s2 border border-border text-white placeholder-muted rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent font-mono pr-16"
                />
                <button
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-white"
                >
                  {showKey ? 'hide' : 'show'}
                </button>
              </div>
              <p className="text-xs text-muted">
                Stored in browser localStorage only — never sent to our servers.
              </p>
            </div>
          )}

          {local.provider === 'ollama' && (
            <div className="bg-s2 border border-border rounded-lg px-4 py-3">
              <p className="text-xs text-muted">
                Ollama runs locally. Make sure{' '}
                <code className="text-violet-400 font-mono">ollama serve</code>{' '}
                is running on your machine before using this option.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="text-sm text-muted hover:text-white px-4 py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="bg-accent hover:bg-violet-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
