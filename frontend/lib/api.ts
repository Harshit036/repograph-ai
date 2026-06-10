import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'changeme-dev-key'

const client = axios.create({
  baseURL: API_URL,
  headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
  timeout: 120_000,
})

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

function getLLMHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem('repograph-workspace')
    if (!raw) return {}
    const { state } = JSON.parse(raw) as { state: { llmConfig: { provider: string; model: string; apiKey: string } } }
    const { provider, model, apiKey } = state.llmConfig
    const headers: Record<string, string> = {}
    if (provider) headers['X-LLM-Provider'] = provider
    if (model)    headers['X-LLM-Model']    = model
    if (apiKey)   headers['X-LLM-Key']      = apiKey
    return headers
  } catch { return {} }
}

function getUserHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem('repograph-workspace')
    if (!raw) return {}
    const { state } = JSON.parse(raw) as { state: { userId: string } }
    return state.userId ? { 'X-User-Id': state.userId } : {}
  } catch { return {} }
}

function withHeaders<T>(fn: () => Promise<T>, includeLLM = false): Promise<T> {
  Object.assign(client.defaults.headers.common, getUserHeader())
  if (includeLLM) Object.assign(client.defaults.headers.common, getLLMHeaders())
  const result = fn()
  result.finally(() => {
    const toRemove = ['X-User-Id', 'X-LLM-Provider', 'X-LLM-Model', 'X-LLM-Key']
    toRemove.forEach(k => delete (client.defaults.headers.common as Record<string, unknown>)[k])
  })
  return result
}

export type Citation = {
  source_id: number; file: string; file_path: string
  start_line: number; end_line: number; preview: string; chunk_text?: string
}

export interface ChatSession {
  id: string; title: string; repo_ids: string[]
  created_at: string | null; updated_at: string | null
}

export const api = {
  health: () => client.get('/health').then(r => r.data),

  stats: () =>
    withHeaders(() => client.get('/stats').then(r => r.data)) as Promise<{
      repos: number; files: number; chunks: number; functions: number
    }>,

  ingest: (repo_url: string, github_login = '', avatar_url = '', github_token = '') =>
    withHeaders(() =>
      client.post('/ingest-repo', { repo_url, github_login, avatar_url, github_token }, { timeout: 600_000 }).then(r => r.data)
    ) as Promise<{
      skipped: boolean; message?: string
      total_files: number; files: { file_name: string; total_chunks: number }[]
    }>,

  repoStatus: (repoId: string) =>
    withHeaders(() => client.get(`/repo/${repoId}/status`).then(r => r.data)) as Promise<{
      has_files: boolean; has_graph: boolean; file_count: number
    }>,

  deleteRepo: (repoId: string) =>
    withHeaders(() => client.delete(`/repo/${repoId}`).then(r => r.data)) as Promise<{ deleted: boolean }>,

  myRepos: () =>
    withHeaders(() => client.get('/my-repos').then(r => r.data)) as Promise<
      { repo_url: string; repo_id: string; commit_sha: string; file_count: number; chunk_count: number; ingested_at: string }[]
    >,

  prDiff: (url: string) =>
    withHeaders(() => client.get('/pr-diff', { params: { url } }).then(r => r.data)) as Promise<{
      title: string; number: number; body: string; repo: string
      files: { filename: string; status: string; additions: number; deletions: number; patch: string }[]
    }>,

  ragQuery: (query: string, messages: ChatMessage[] = [], repo_ids: string[] = []) =>
    withHeaders(() => client.post('/rag-query', { query, messages, repo_ids }).then(r => r.data), true) as Promise<{
      response: string; citations: Citation[]
    }>,

  ragQueryStream: (
    query: string,
    messages: ChatMessage[],
    repo_ids: string[],
    onToken: (t: string) => void,
    onDone: (citations: Citation[]) => void,
    onError: (e: string) => void,
    onStep?: (step: string) => void,
  ): Promise<void> => {
    const headers: Record<string, string> = {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      ...getLLMHeaders(),
      ...getUserHeader(),
    }
    return fetch(`${API_URL}/rag-query/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, messages, repo_ids }),
    }).then(async res => {
      if (!res.ok || !res.body) { onError('Stream request failed'); return }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'token') onToken(evt.content)
            else if (evt.type === 'citations') onDone(evt.data)
            else if (evt.type === 'step') onStep?.(evt.content)
            else if (evt.type === 'error') onError(evt.content)
          } catch { /* skip malformed */ }
        }
      }
    })
  },

  agentQuery: (query: string, messages: ChatMessage[] = []) =>
    withHeaders(() => client.post('/agent-query', { query, messages }).then(r => r.data), true) as Promise<{
      response: string; actions: string[]; memory: { discovered_facts: string[]; searched_queries: string[] }
    }>,

  architecture: () =>
    withHeaders(() => client.get('/architecture-summary').then(r => r.data), true) as Promise<{ summary: string }>,

  architectureStream: (
    onToken: (t: string) => void,
    onDone: () => void,
    onError: (e: string) => void,
  ): Promise<void> => {
    const headers: Record<string, string> = {
      'X-API-Key': API_KEY, ...getLLMHeaders(), ...getUserHeader(),
    }
    return fetch(`${API_URL}/architecture-summary/stream`, { headers }).then(async res => {
      if (!res.ok || !res.body) { onError('Stream failed'); return }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'token') onToken(evt.content)
            else if (evt.type === 'done') onDone()
          } catch { /* skip */ }
        }
      }
    })
  },

  onboarding: () =>
    withHeaders(() => client.get('/onboarding-guide').then(r => r.data), true) as Promise<{
      guide: string; entry_points: { file: string; reasons: string[] }[]
    }>,

  onboardingStream: (
    onEntryPoints: (eps: { file: string; reasons: string[] }[]) => void,
    onToken: (t: string) => void,
    onDone: () => void,
    onError: (e: string) => void,
  ): Promise<void> => {
    const headers: Record<string, string> = {
      'X-API-Key': API_KEY, ...getLLMHeaders(), ...getUserHeader(),
    }
    return fetch(`${API_URL}/onboarding-guide/stream`, { headers }).then(async res => {
      if (!res.ok || !res.body) { onError('Stream failed'); return }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'entry_points') onEntryPoints(evt.data)
            else if (evt.type === 'token') onToken(evt.content)
            else if (evt.type === 'done') onDone()
          } catch { /* skip */ }
        }
      }
    })
  },

  trace: (keyword: string, direction: 'callees' | 'callers' = 'callees', maxDepth = 4) =>
    withHeaders(() => client.get('/trace-flow', { params: { keyword, direction, max_depth: maxDepth } }).then(r => r.data)) as Promise<{
      keyword: string
      direction: string
      nodes: { id: string; name: string; file: string; file_path: string; line: number }[]
      edges: { from: string; to: string }[]
      roots: string[]
      total: number
    }>,

  fileTree: (repoId?: string) =>
    withHeaders(() => client.get('/files', { params: repoId ? { repo_id: repoId } : {} }).then(r => r.data)) as Promise<
      { file_path: string; language: string; size: number }[]
    >,

  fileContent: (path: string, repoId?: string) =>
    withHeaders(() => client.get('/file', { params: { path, ...(repoId ? { repo_id: repoId } : {}) } }).then(r => r.data)) as Promise<
      { content: string; language: string }
    >,

  deadCode: (repoId?: string) =>
    withHeaders(() => client.get('/dead-code', { params: repoId ? { repo_id: repoId } : {} }).then(r => r.data), true) as Promise<{
      total: number; by_file: { file: string; functions: { name: string; line: number }[] }[]; message: string
    }>,

  testCoverage: (repoId?: string) =>
    withHeaders(() => client.get('/test-coverage', { params: repoId ? { repo_id: repoId } : {} }).then(r => r.data), true) as Promise<{
      total: number; by_file: { file: string; functions: { name: string; line: number }[] }[]; message: string
    }>,

  globalSearch: (q: string) =>
    withHeaders(() => client.get('/search/global', { params: { q } }).then(r => r.data)) as Promise<{
      files: { file_path: string; display: string; language: string }[]
      functions: { name: string; file_path: string; display: string; line: number }[]
      code: { file_path: string; display: string; line: number; snippet: string }[]
    }>,

  // ── Chat sessions ────────────────────────────────────────────────────────
  sessions: {
    list: () =>
      withHeaders(() => client.get('/sessions').then(r => r.data)) as Promise<ChatSession[]>,
    create: (title?: string, repo_ids?: string[]) =>
      withHeaders(() => client.post('/sessions', { title: title ?? '', repo_ids: repo_ids ?? [] }).then(r => r.data)) as Promise<ChatSession>,
    delete: (id: string) =>
      withHeaders(() => client.delete(`/sessions/${id}`).then(r => r.data)) as Promise<{ deleted: boolean }>,
    rename: (id: string, title: string) =>
      withHeaders(() => client.patch(`/sessions/${id}/title`, { title }).then(r => r.data)),
    messages: (id: string) =>
      withHeaders(() => client.get(`/sessions/${id}/messages`).then(r => r.data)) as Promise<
        { id: string; role: string; content: string; citations: Citation[] | null; actions: string[] | null; created_at: string | null }[]
      >,
    saveMessage: (id: string, role: string, content: string, citations?: Citation[] | null, actions?: string[] | null) =>
      withHeaders(() => client.post(`/sessions/${id}/messages`, { role, content, citations, actions }).then(r => r.data)),
  },
}
