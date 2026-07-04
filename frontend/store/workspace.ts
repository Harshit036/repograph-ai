'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LLMConfig {
  provider: string
  model: string
  apiKey: string
}

export interface RepoInfo {
  url: string
  repoId: string
  commitSha: string
  totalFiles: number
  totalChunks: number
  files: { file_name: string; total_chunks: number }[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: {
    source_id: number
    file: string
    file_path: string
    rel_path?: string
    start_line: number
    end_line: number
    preview: string
    chunk_text?: string
  }[]
  actions?: string[]
  steps?: string[]
  memory?: { discovered_facts: string[]; searched_queries: string[] }
  error?: boolean
  streaming?: boolean
}

export type ToolTab = 'onboarding' | 'architecture' | 'trace' | 'deadcode' | 'testcoverage'

export interface ToolResult {
  loading: boolean
  data: unknown
  error?: string
  streaming?: boolean
}

export interface PrFile {
  filename: string
  status: string
  additions: number
  deletions: number
  patch: string
}

export interface PrDiff {
  title: string
  number: number
  body: string
  repo: string
  files: PrFile[]
}

export interface WorkspaceState {
  // Auth
  userId: string
  githubLogin: string
  avatarUrl: string
  githubToken: string

  // Repo — only the current ingested repo is tracked (no persistent history)
  currentRepo: RepoInfo | null
  ingestionStatus: 'idle' | 'loading' | 'done' | 'error' | 'skipped'
  ingestionError: string | null

  // Chat — session-only; conversation memory is threaded per request, not persisted
  messages: Message[]
  deepMode: boolean

  // LLM config (persisted)
  llmConfig: LLMConfig

  // Right panel (tools)
  activeToolTab: ToolTab
  toolResults: Partial<Record<ToolTab, ToolResult>>

  // PR diff
  prDiff: PrDiff | null
  prDiffLoading: boolean

  // Actions
  setUser: (userId: string, githubLogin: string, avatarUrl: string) => void
  setGithubToken: (token: string) => void
  setCurrentRepo: (repo: RepoInfo | null) => void
  setIngestionStatus: (s: WorkspaceState['ingestionStatus'], error?: string) => void
  addMessage: (msg: Message) => void
  updateMessage: (id: string, patch: Partial<Message>) => void
  clearMessages: () => void
  setDeepMode: (deep: boolean) => void
  setLLMConfig: (cfg: Partial<LLMConfig>) => void
  setActiveToolTab: (tab: ToolTab) => void
  setToolResult: (tab: ToolTab, result: ToolResult) => void
  setPrDiff: (diff: PrDiff | null, loading?: boolean) => void
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      userId: '',
      githubLogin: '',
      avatarUrl: '',
      githubToken: '',
      currentRepo: null,
      ingestionStatus: 'idle',
      ingestionError: null,
      messages: [],
      deepMode: false,
      llmConfig: { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: '' },
      activeToolTab: 'onboarding',
      toolResults: {},
      prDiff: null,
      prDiffLoading: false,

      setUser: (userId, githubLogin, avatarUrl) => set({ userId, githubLogin, avatarUrl }),
      setGithubToken: (githubToken) => set({ githubToken }),
      setCurrentRepo: (currentRepo) => set({ currentRepo }),
      setIngestionStatus: (ingestionStatus, error) =>
        set({ ingestionStatus, ingestionError: error ?? null }),
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      updateMessage: (id, patch) =>
        set((s) => ({ messages: s.messages.map(m => m.id === id ? { ...m, ...patch } : m) })),
      clearMessages: () => set({ messages: [] }),
      setDeepMode: (deepMode) => set({ deepMode }),
      setLLMConfig: (cfg) => set((s) => ({ llmConfig: { ...s.llmConfig, ...cfg } })),
      setActiveToolTab: (activeToolTab) => set({ activeToolTab }),
      setToolResult: (tab, result) =>
        set((s) => ({ toolResults: { ...s.toolResults, [tab]: result } })),
      setPrDiff: (prDiff, loading = false) => set({ prDiff, prDiffLoading: loading }),
    }),
    {
      name: 'repograph-workspace',
      partialize: (s) => ({
        llmConfig:   s.llmConfig,
        userId:      s.userId,
        githubLogin: s.githubLogin,
        avatarUrl:   s.avatarUrl,
        githubToken: s.githubToken,
        deepMode:    s.deepMode,
      }),
    }
  )
)
