import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'changeme-dev-key'

const client = axios.create({
  baseURL: API_URL,
  headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
  timeout: 120_000,
})

export const api = {
  health: () => client.get('/health').then(r => r.data),

  stats: () => client.get('/stats').then(r => r.data) as Promise<{
    repos: number; files: number; chunks: number; functions: number
  }>,

  ingest: (repo_url: string) =>
    client.post('/ingest-repo', { repo_url }).then(r => r.data) as Promise<{
      total_files: number
      files: { file_name: string; total_chunks: number }[]
    }>,

  ragQuery: (query: string) =>
    client.post('/rag-query', { query }).then(r => r.data) as Promise<{
      response: string
      citations: { source_id: number; file: string; file_path: string; preview: string }[]
    }>,

  agentQuery: (query: string) =>
    client.post('/agent-query', { query }).then(r => r.data) as Promise<{
      response: string
      actions: string[]
      memory: { discovered_facts: string[]; searched_queries: string[] }
    }>,

  graph: () => client.get('/repository-graph').then(r => r.data) as Promise<
    Record<string, { functions: string[]; imports: string[]; calls: string[] }>
  >,

  architecture: () =>
    client.get('/architecture-summary').then(r => r.data) as Promise<{ summary: string }>,

  onboarding: () =>
    client.get('/onboarding-guide').then(r => r.data) as Promise<{
      guide: string
      entry_points: { file: string; reasons: string[] }[]
    }>,

  trace: (keyword: string) =>
    client.get('/trace-flow', { params: { keyword } }).then(r => r.data) as Promise<
      { function: string; file: string; calls: string[] }[]
    >,

  tree: () => client.get('/repository-tree').then(r => r.data),
}
