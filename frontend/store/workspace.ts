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
  totalFiles: number
  totalChunks: number
  files: { file_name: string; total_chunks: number }[]
}

export interface UserRepo {
  repo_url: string
  repo_id: string
  commit_sha: string
  file_count: number
  chunk_count: number
  ingested_at: string
}

export type ChatMode = 'rag' | 'agent'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: { source_id: number; file: string; file_path: string; preview: string; chunk_text?: string }[]
  actions?: string[]
  memory?: { discovered_facts: string[]; searched_queries: string[] }
  error?: boolean
  streaming?: boolean
}

export type ToolTab = 'onboarding' | 'architecture' | 'tree' | 'graph' | 'trace'

export interface ToolResult {
  loading: boolean
  data: unknown
  error?: string
}

export interface WorkspaceState {
  // Auth
  userId: string
  githubLogin: string
  avatarUrl: string

  // Repo
  currentRepo: RepoInfo | null
  repoHistory: UserRepo[]
  ingestionStatus: 'idle' | 'loading' | 'done' | 'error' | 'skipped'
  ingestionError: string | null

  // Chat
  messages: Message[]
  chatMode: ChatMode

  // LLM config (persisted)
  llmConfig: LLMConfig

  // Right panel
  activeToolTab: ToolTab
  toolResults: Partial<Record<ToolTab, ToolResult>>

  // Actions
  setUser: (userId: string, githubLogin: string, avatarUrl: string) => void
  setCurrentRepo: (repo: RepoInfo | null) => void
  setRepoHistory: (history: UserRepo[]) => void
  setIngestionStatus: (s: WorkspaceState['ingestionStatus'], error?: string) => void
  addMessage: (msg: Message) => void
  updateMessage: (id: string, patch: Partial<Message>) => void
  clearMessages: () => void
  setChatMode: (mode: ChatMode) => void
  setLLMConfig: (cfg: Partial<LLMConfig>) => void
  setActiveToolTab: (tab: ToolTab) => void
  setToolResult: (tab: ToolTab, result: ToolResult) => void
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      userId: '',
      githubLogin: '',
      avatarUrl: '',
      currentRepo: null,
      repoHistory: [],
      ingestionStatus: 'idle',
      ingestionError: null,
      messages: [],
      chatMode: 'rag',
      llmConfig: { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: '' },
      activeToolTab: 'onboarding',
      toolResults: {},

      setUser: (userId, githubLogin, avatarUrl) =>
        set({ userId, githubLogin, avatarUrl }),
      setCurrentRepo: (currentRepo) => set({ currentRepo }),
      setRepoHistory: (repoHistory) => set({ repoHistory }),
      setIngestionStatus: (ingestionStatus, error) =>
        set({ ingestionStatus, ingestionError: error ?? null }),
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      updateMessage: (id, patch) =>
        set((s) => ({ messages: s.messages.map(m => m.id === id ? { ...m, ...patch } : m) })),
      clearMessages: () => set({ messages: [] }),
      setChatMode: (chatMode) => set({ chatMode }),
      setLLMConfig: (cfg) =>
        set((s) => ({ llmConfig: { ...s.llmConfig, ...cfg } })),
      setActiveToolTab: (activeToolTab) => set({ activeToolTab }),
      setToolResult: (tab, result) =>
        set((s) => ({ toolResults: { ...s.toolResults, [tab]: result } })),
    }),
    {
      name: 'repograph-workspace',
      // Persist LLM config and user identity — not chat/repo session state
      partialize: (s) => ({
        llmConfig:   s.llmConfig,
        userId:      s.userId,
        githubLogin: s.githubLogin,
        avatarUrl:   s.avatarUrl,
      }),
    }
  )
)
