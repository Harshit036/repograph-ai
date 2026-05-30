'use client'
import { useRef, useEffect, useState } from 'react'
import { flatToD3Tree, D3TreeNode } from '@/lib/tree-to-d3'

const EXT_COLOR: Record<string, string> = {
  '.py':   '#3b82f6',
  '.ts':   '#8b5cf6',
  '.tsx':  '#a78bfa',
  '.js':   '#f59e0b',
  '.jsx':  '#fbbf24',
  '.go':   '#10b981',
  '.java': '#ef4444',
  '.md':   '#6b7280',
  '.json': '#94a3b8',
  '.css':  '#ec4899',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function TreeView({ data }: { data: any }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 })
  const [Tree, setTree] = useState<React.ComponentType<unknown> | null>(null)

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width: Math.max(300, width), height: Math.max(400, height) })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Dynamically import react-d3-tree (it needs window)
  useEffect(() => {
    import('react-d3-tree').then(mod => {
      setTree(() => mod.default)
    })
  }, [])

  if (!data?.ids) return <p className="text-xs text-muted p-4">No tree data available.</p>

  const treeData = flatToD3Tree(data)

  const renderNode = ({ nodeDatum }: { nodeDatum: D3TreeNode & { _isFile?: boolean; _ext?: string } }) => {
    const isFile = nodeDatum._isFile
    const color = isFile ? (EXT_COLOR[nodeDatum._ext || ''] ?? '#52525b') : '#6b7280'
    const radius = isFile ? 5 : 7

    return (
      <g>
        <circle r={radius} fill={color} stroke={isFile ? color : '#374151'} strokeWidth={1.5} />
        <text
          x={isFile ? 10 : -10}
          textAnchor={isFile ? 'start' : 'end'}
          dy="0.31em"
          style={{ fontSize: '10px', fill: isFile ? '#d4d4d8' : '#a1a1aa', fontFamily: 'monospace' }}
        >
          {nodeDatum.name}
        </text>
        {isFile && nodeDatum.attributes?.chunks ? (
          <text x={10} dy="1.4em" style={{ fontSize: '8px', fill: '#52525b', fontFamily: 'monospace' }}>
            {nodeDatum.attributes.chunks}c · {nodeDatum.attributes.fns}fn
          </text>
        ) : null}
      </g>
    )
  }

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] bg-zinc-950 rounded-xl border border-border overflow-hidden">
      {Tree ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Tree
          data={treeData}
          orientation="horizontal"
          pathFunc="elbow"
          translate={{ x: 60, y: dimensions.height / 2 }}
          dimensions={dimensions}
          separation={{ siblings: 0.5, nonSiblings: 0.6 }}
          nodeSize={{ x: 200, y: 28 }}
          renderCustomNodeElement={renderNode as never}
          collapsible
          initialDepth={2}
          pathClassFunc={() => 'stroke-border'}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          svgClassName="[&_path]:stroke-zinc-700 [&_path]:fill-none"
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
