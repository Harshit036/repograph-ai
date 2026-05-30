'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Upload, CheckCircle, FileCode2, AlertCircle, Github } from 'lucide-react'

interface IngestResult {
  total_files: number
  files: { file_name: string; total_chunks: number }[]
}

function Spinner() {
  return (
    <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
  )
}

export default function IngestPage() {
  const [url, setUrl]         = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<IngestResult | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const handleIngest = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await api.ingest(url.trim())
      setResult(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ingestion failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Ingest Repository</h1>
        <p className="text-muted text-sm mt-1">Clone a GitHub repo and index it into the vector database</p>
      </div>

      {/* Input card */}
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-300 flex items-center gap-2 mb-2">
            <Github className="w-4 h-4" /> GitHub Repository URL
          </span>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleIngest()}
            placeholder="https://github.com/username/repository"
            className="w-full bg-s2 border border-border text-white placeholder-muted rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors font-mono"
          />
        </label>

        <button
          onClick={handleIngest}
          disabled={loading || !url.trim()}
          className="flex items-center gap-2 bg-accent hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? <Spinner /> : <Upload className="w-4 h-4" />}
          {loading ? 'Ingesting…' : 'Ingest Repository'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-danger/10 border border-danger/30 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-success/5">
            <CheckCircle className="w-5 h-5 text-success" />
            <div>
              <p className="text-sm font-semibold text-white">Ingestion complete</p>
              <p className="text-xs text-muted">{result.total_files} files indexed</p>
            </div>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {result.files.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode2 className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                  <span className="text-sm text-zinc-300 font-mono truncate">{f.file_name}</span>
                </div>
                <span className="text-xs text-muted bg-s2 px-2 py-0.5 rounded-full ml-4 flex-shrink-0">
                  {f.total_chunks} chunks
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
