'use client'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { TreePine, AlertCircle, RotateCcw, FileCode2, FolderOpen } from 'lucide-react'

interface TreeData {
  ids: string[]
  labels: string[]
  parents: string[]
  values: number[]
  extensions: string[]
  functions: number[]
  chunks: number[]
  colors: string[]
  is_file: boolean[]
}

function Spinner() {
  return <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
}

function Legend({ data }: { data: TreeData }) {
  const extMap: Record<string, string> = {}
  data.extensions.forEach((ext, i) => {
    if (ext && data.is_file[i]) extMap[ext] = data.colors[i]
  })
  const entries = Object.entries(extMap).sort()
  if (entries.length === 0) return null
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(([ext, color]) => (
        <div key={ext} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs text-muted font-mono">{ext}</span>
        </div>
      ))}
    </div>
  )
}

export default function TreePage() {
  const plotRef   = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [loaded,  setLoaded]  = useState(false)
  const [stats,   setStats]   = useState<{ files: number; dirs: number } | null>(null)
  const [treeData, setTreeData] = useState<TreeData | null>(null)

  const loadTree = async () => {
    setLoading(true); setError(null)
    try {
      const data: TreeData = await api.tree()
      if (!data.ids || data.ids.length === 0) {
        setError('No repository data. Ingest a repository first.')
        return
      }

      setTreeData(data)
      const fileCount = data.is_file.filter(Boolean).length
      const dirCount  = data.is_file.filter(f => !f).length
      setStats({ files: fileCount, dirs: dirCount })

      if (!plotRef.current) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Plotly = (await import('plotly.js-dist-min')) as any

      // Custom hover text
      const hoverText = data.ids.map((_, i) => {
        if (data.is_file[i]) {
          return [
            `<b>${data.labels[i]}</b>`,
            `Type: ${data.extensions[i] || 'unknown'}`,
            `Chunks: ${data.chunks[i]}`,
            `Functions: ${data.functions[i]}`,
          ].join('<br>')
        }
        return `<b>${data.labels[i]}/</b><br>${data.values[i]} chunks total`
      })

      const trace = {
        type: 'sunburst',
        ids:    data.ids,
        labels: data.labels,
        parents: data.parents,
        values: data.values,
        branchvalues: 'total',
        hovertext: hoverText,
        hoverinfo: 'text',
        marker: {
          colors: data.colors,
          line: { color: '#09090b', width: 1.5 },
        },
        leaf: { opacity: 0.9 },
        textfont: { family: 'JetBrains Mono, monospace', size: 11, color: '#fafafa' },
        insidetextorientation: 'radial',
        maxdepth: 4,
      }

      const layout = {
        paper_bgcolor: '#09090b',
        plot_bgcolor: '#09090b',
        font: { color: '#a1a1aa', family: 'Inter, sans-serif' },
        margin: { l: 0, r: 0, t: 0, b: 0 },
        sunburstcolorway: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
        colorway:         ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
      }

      Plotly.newPlot(plotRef.current, [trace], layout, {
        displayModeBar: false,
        responsive: true,
      })
      setLoaded(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tree')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Repository Tree</h1>
          <p className="text-muted text-sm mt-1">
            Sunburst map — click to zoom · segments sized by chunk count · colored by file type
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <div className="flex items-center gap-4 bg-surface border border-border rounded-lg px-4 py-2">
              <div className="flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs text-zinc-300">{stats.files} files</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-zinc-300">{stats.dirs} dirs</span>
              </div>
            </div>
          )}
          <button
            onClick={loadTree}
            disabled={loading}
            className="flex items-center gap-2 bg-accent hover:bg-violet-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? <Spinner /> : loaded ? <RotateCcw className="w-4 h-4" /> : <TreePine className="w-4 h-4" />}
            {loading ? 'Building…' : loaded ? 'Refresh' : 'Load Tree'}
          </button>
        </div>
      </div>

      {/* Legend */}
      {treeData && <Legend data={treeData} />}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-danger/10 border border-danger/30 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loaded && !loading && !error && (
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 14rem)' }}>
          <div className="text-center space-y-3">
            <TreePine className="w-14 h-14 text-border mx-auto" strokeWidth={1} />
            <p className="text-muted text-sm">Click Load Tree to render the full repository structure</p>
            <p className="text-xs text-border">Segments are sized by chunk count · click any ring to drill down</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div
        ref={plotRef}
        className="rounded-xl border border-border bg-[#09090b]"
        style={{ height: 'calc(100vh - 13rem)', width: '100%', display: loaded ? 'block' : 'none' }}
      />
    </div>
  )
}
