import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'changeme-dev-key'

const client = axios.create({
  baseURL: API_URL,
  headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
  timeout: 120_000,
})

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

// Read LLM config from Zustand localStorage persistence
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

// Read authenticated user ID from Zustand store
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

export const api = {
  health: () => client.get('/health').then(r => r.data),

  stats: () =>
    withHeaders(() => client.get('/stats').then(r => r.data)) as Promise<{
      repos: number; files: number; chunks: number; functions: number
    }>,

  ingest: (repo_url: string, github_login = '', avatar_url = '') =>
    withHeaders(() =>
      client.post('/ingest-repo', { repo_url, github_login, avatar_url }, { timeout: 600_000 }).then(r => r.data)
    ) as Promise<{
      skipped: boolean
      message?: string
      total_files: number
      files: { file_name: string; total_chunks: number }[]
    }>,

  myRepos: () =>
    withHeaders(() => client.get('/my-repos').then(r => r.data)) as Promise<
      { repo_url: string; repo_id: string; commit_sha: string; file_count: number; chunk_count: number; ingested_at: string }[]
    >,

  ragQuery: (query: string, messages: ChatMessage[] = []) =>
    withHeaders(() => client.post('/rag-query', { query, messages }).then(r => r.data), true) as Promise<{
      response: string
      citations: { source_id: number; file: string; file_path: string; preview: string; chunk_text?: string }[]
    }>,

  ragQueryStream: (
    query: string,
    messages: ChatMessage[],
    onToken: (t: string) => void,
    onDone: (citations: { source_id: number; file: string; file_path: string; preview: string; chunk_text?: string }[]) => void,
    onError: (e: string) => void,
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
      body: JSON.stringify({ query, messages }),
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
            else if (evt.type === 'error') onError(evt.content)
          } catch { /* skip malformed */ }
        }
      }
    })
  },

  agentQuery: (query: string, messages: ChatMessage[] = []) =>
    withHeaders(() => client.post('/agent-query', { query, messages }).then(r => r.data), true) as Promise<{
      response: string
      actions: string[]
      memory: { discovered_facts: string[]; searched_queries: string[] }
    }>,

  graph: () =>
    withHeaders(() => client.get('/repository-graph').then(r => r.data)) as Promise<
      Record<string, { functions: string[]; imports: string[]; calls: string[] }>
    >,

  architecture: () =>
    withHeaders(() => client.get('/architecture-summary').then(r => r.data), true) as Promise<{ summary: string }>,

  onboarding: () =>
    withHeaders(() => client.get('/onboarding-guide').then(r => r.data), true) as Promise<{
      guide: string
      entry_points: { file: string; reasons: string[] }[]
    }>,

  trace: (keyword: string) =>
    withHeaders(() => client.get('/trace-flow', { params: { keyword } }).then(r => r.data)) as Promise<
      { function: string; file: string; calls: string[] }[]
    >,

  tree: () =>
    withHeaders(() => client.get('/repository-tree').then(r => r.data)),
}
