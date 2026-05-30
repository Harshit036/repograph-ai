'use client'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Network, AlertCircle, RotateCcw } from 'lucide-react'

type GraphData = Record<string, { functions: string[]; imports: string[]; calls: string[] }>

function Spinner() {
  return <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
}

export default function GraphPage() {
  const plotRef   = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [loaded,  setLoaded]  = useState(false)

  const loadGraph = async () => {
    setLoading(true); setError(null)
    try {
      const data: GraphData = await api.graph()
      if (!plotRef.current) return

      const entries = Object.entries(data)
      if (entries.length === 0) {
        setError('No graph data. Ingest a repository first.')
        return
      }

      const sorted = entries
        .sort((a, b) => b[1].functions.length - a[1].functions.length)
        .slice(0, 40)

      const nodeSet = new Set(sorted.map(([fp]) => fp))
      const n = sorted.length

      const positions: Record<string, [number, number, number]> = {}
      sorted.forEach(([fp, nd], i) => {
        const angle = (2 * Math.PI * i) / Math.max(n, 1)
        const r = 1 + (nd.functions.length / 20)
        positions[fp] = [
          Math.cos(angle) * r,
          Math.sin(angle) * r,
          nd.functions.length * 0.12,
        ]
      })

      const ex: number[] = [], ey: number[] = [], ez: number[] = []
      sorted.forEach(([fp, nd]) => {
        nd.imports.forEach(imp => {
          const target = sorted.find(([p]) => p.includes(imp.replace(/\./g, '/')) && p !== fp)?.[0]
          if (target && nodeSet.has(target)) {
            const [x0, y0, z0] = positions[fp]
            const [x1, y1, z1] = positions[target]
            ex.push(x0, x1, NaN); ey.push(y0, y1, NaN); ez.push(z0, z1, NaN)
          }
        })
      })

      const dirs = sorted.map(([fp]) => fp.split('/').slice(-3, -1).join('/'))
      const uniqueDirs = [...new Set(dirs)]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Plotly = (await import('plotly.js-dist-min')) as any

      const traces = [
        {
          type: 'scatter3d',
          mode: 'lines',
          x: ex, y: ey, z: ez,
          line: { width: 1, color: '#3f3f46' },
          hoverinfo: 'none',
          name: 'imports',
        },
        {
          type: 'scatter3d',
          mode: 'markers+text',
          x: sorted.map(([fp]) => positions[fp][0]),
          y: sorted.map(([fp]) => positions[fp][1]),
          z: sorted.map(([fp]) => positions[fp][2]),
          marker: {
            size: sorted.map(([, nd]) => Math.max(4, 3 + nd.functions.length * 0.8)),
            color: sorted.map(([fp]) => uniqueDirs.indexOf(fp.split('/').slice(-3, -1).join('/'))),
            colorscale: 'Plasma',
            opacity: 0.9,
            line: { width: 0.5, color: '#09090b' },
          },
          text: sorted.map(([fp]) => fp.split('/').pop() ?? ''),
          textposition: 'top center',
          textfont: { size: 7, color: '#a1a1aa' },
          hovertext: sorted.map(([fp, nd]) =>
            `<b>${fp.split('/').pop()}</b><br>${nd.functions.length} functions<br>${fp.split('/').slice(-3, -1).join('/')}`
          ),
          hoverinfo: 'text',
          name: 'files',
        },
      ]

      const layout = {
        showlegend: false,
        paper_bgcolor: '#09090b',
        font: { color: '#71717a' },
        margin: { l: 0, r: 0, t: 0, b: 0 },
        scene: {
          bgcolor: '#09090b',
          xaxis: { showgrid: false, zeroline: false, showticklabels: false, title: '' },
          yaxis: { showgrid: false, zeroline: false, showticklabels: false, title: '' },
          zaxis: {
            showgrid: true, gridcolor: '#27272a',
            zeroline: false, showticklabels: false,
            title: { text: 'complexity ↑', font: { color: '#52525b', size: 10 } },
          },
          camera: { eye: { x: 1.6, y: 1.6, z: 0.8 } },
        },
      }

      Plotly.newPlot(plotRef.current, traces, layout, { displayModeBar: false, responsive: true })
      setLoaded(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load graph')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4" style={{ height: 'calc(100vh - 4rem)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Repository Graph</h1>
          <p className="text-muted text-sm mt-1">3D — drag to rotate · scroll to zoom · hover for details · Z = complexity</p>
        </div>
        <button
          onClick={loadGraph}
          disabled={loading}
          className="flex items-center gap-2 bg-accent hover:bg-violet-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? <Spinner /> : loaded ? <RotateCcw className="w-4 h-4" /> : <Network className="w-4 h-4" />}
          {loading ? 'Building…' : loaded ? 'Refresh' : 'Load Graph'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-danger/10 border border-danger/30 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div
        ref={plotRef}
        className="bg-[#09090b] rounded-xl border border-border flex-1"
        style={{ height: 'calc(100vh - 11rem)', width: '100%' }}
      />

      {!loaded && !loading && !error && (
        <div className="absolute inset-0 ml-[220px] flex items-center justify-center pointer-events-none" style={{ top: '11rem' }}>
          <div className="text-center space-y-2">
            <Network className="w-12 h-12 text-border mx-auto" strokeWidth={1} />
            <p className="text-muted text-sm">Click Load Graph to render the 3D dependency graph</p>
          </div>
        </div>
      )}
    </div>
  )
}
