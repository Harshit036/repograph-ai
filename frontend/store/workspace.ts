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

export interface ChatSession {
  id: string
  title: string
  repo_ids: string[]
  created_at: string | null
  updated_at: string | null
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: {
    source_id: number
    file: string
    file_path: string
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

export type CenterTab = 'chat' | 'explorer'

export interface CodeViewerState {
  filePath: string | null
  line: number | null
  repoId: string | null
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

  // Repo
  currentRepo: RepoInfo | null
  repoHistory: UserRepo[]
  ingestionStatus: 'idle' | 'loading' | 'done' | 'error' | 'skipped'
  ingestionError: string | null

  // Multi-repo context (empty = search all repos for this user)
  contextRepos: string[]

  // Chat
  messages: Message[]
  deepMode: boolean

  // Chat sessions
  sessions: ChatSession[]
  currentSessionId: string | null

  // LLM config (persisted)
  llmConfig: LLMConfig

  // Center panel
  centerTab: CenterTab

  // Right panel (tools only now)
  activeToolTab: ToolTab
  toolResults: Partial<Record<ToolTab, ToolResult>>
  codeViewerState: CodeViewerState

  // PR diff
  prDiff: PrDiff | null
  prDiffLoading: boolean

  // Actions
  setUser: (userId: string, githubLogin: string, avatarUrl: string) => void
  setGithubToken: (token: string) => void
  setCurrentRepo: (repo: RepoInfo | null) => void
  setRepoHistory: (history: UserRepo[]) => void
  setIngestionStatus: (s: WorkspaceState['ingestionStatus'], error?: string) => void
  addMessage: (msg: Message) => void
  updateMessage: (id: string, patch: Partial<Message>) => void
  clearMessages: () => void
  setDeepMode: (deep: boolean) => void
  setLLMConfig: (cfg: Partial<LLMConfig>) => void
  setCenterTab: (tab: CenterTab) => void
  setActiveToolTab: (tab: ToolTab) => void
  setToolResult: (tab: ToolTab, result: ToolResult) => void
  openCodeViewer: (filePath: string, line: number, repoId?: string) => void
  deleteRepo: (repoId: string) => void
  toggleContextRepo: (repoId: string) => void
  setContextRepos: (ids: string[]) => void
  setSessions: (sessions: ChatSession[]) => void
  setCurrentSessionId: (id: string | null) => void
  addSession: (session: ChatSession) => void
  removeSession: (id: string) => void
  updateSessionTitle: (id: string, title: string) => void
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
      repoHistory: [],
      ingestionStatus: 'idle',
      ingestionError: null,
      contextRepos: [],
      messages: [],
      deepMode: false,
      sessions: [],
      currentSessionId: null,
      llmConfig: { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: '' },
      centerTab: 'chat',
      activeToolTab: 'onboarding',
      toolResults: {},
      codeViewerState: { filePath: null, line: null, repoId: null },
      prDiff: null,
      prDiffLoading: false,

      setUser: (userId, githubLogin, avatarUrl) => set({ userId, githubLogin, avatarUrl }),
      setGithubToken: (githubToken) => set({ githubToken }),
      setCurrentRepo: (currentRepo) => set({ currentRepo }),
      setRepoHistory: (repoHistory) => set({ repoHistory }),
      setIngestionStatus: (ingestionStatus, error) =>
        set({ ingestionStatus, ingestionError: error ?? null }),
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      updateMessage: (id, patch) =>
        set((s) => ({ messages: s.messages.map(m => m.id === id ? { ...m, ...patch } : m) })),
      clearMessages: () => set({ messages: [], currentSessionId: null, centerTab: 'chat' }),
      setDeepMode: (deepMode) => set({ deepMode }),
      setLLMConfig: (cfg) => set((s) => ({ llmConfig: { ...s.llmConfig, ...cfg } })),
      setCenterTab: (centerTab) => set({ centerTab }),
      setActiveToolTab: (activeToolTab) => set({ activeToolTab }),
      setToolResult: (tab, result) =>
        set((s) => ({ toolResults: { ...s.toolResults, [tab]: result } })),
      openCodeViewer: (filePath, line, repoId) =>
        set({ centerTab: 'explorer', codeViewerState: { filePath, line, repoId: repoId ?? null } }),
      deleteRepo: (repoId) =>
        set((s) => ({
          repoHistory: s.repoHistory.filter(r => r.repo_id !== repoId),
          contextRepos: s.contextRepos.filter(id => id !== repoId),
          currentRepo: s.currentRepo && s.repoHistory.find(r => r.repo_id === repoId)?.repo_url === s.currentRepo.url
            ? null : s.currentRepo,
        })),
      toggleContextRepo: (repoId) =>
        set((s) => ({
          contextRepos: s.contextRepos.includes(repoId)
            ? s.contextRepos.filter(id => id !== repoId)
            : [...s.contextRepos, repoId],
        })),
      setContextRepos: (contextRepos) => set({ contextRepos }),
      setSessions: (sessions) => set({ sessions }),
      setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
      addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
      removeSession: (id) =>
        set((s) => ({
          sessions: s.sessions.filter(sess => sess.id !== id),
          currentSessionId: s.currentSessionId === id ? null : s.currentSessionId,
          messages: s.currentSessionId === id ? [] : s.messages,
        })),
      updateSessionTitle: (id, title) =>
        set((s) => ({ sessions: s.sessions.map(sess => sess.id === id ? { ...sess, title } : sess) })),
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
