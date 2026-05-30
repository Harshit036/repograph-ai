type GraphData = Record<string, { functions: string[]; imports: string[]; calls: string[] }>

export function graphToPlotly(data: GraphData): { data: unknown[]; layout: unknown } {
  const entries = Object.entries(data)
  if (entries.length === 0) return { data: [], layout: {} }

  const sorted = entries
    .sort((a, b) => b[1].functions.length - a[1].functions.length)
    .slice(0, 40)

  const n = sorted.length
  const positions: Record<string, [number, number, number]> = {}
  sorted.forEach(([fp, nd], i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1)
    const r = 1 + nd.functions.length / 20
    positions[fp] = [Math.cos(angle) * r, Math.sin(angle) * r, nd.functions.length * 0.12]
  })

  const nodeSet = new Set(sorted.map(([fp]) => fp))
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

  return {
    data: [
      {
        type: 'scatter3d', mode: 'lines',
        x: ex, y: ey, z: ez,
        line: { width: 1, color: '#3f3f46' },
        hoverinfo: 'none', name: 'imports',
      },
      {
        type: 'scatter3d', mode: 'markers+text',
        x: sorted.map(([fp]) => positions[fp][0]),
        y: sorted.map(([fp]) => positions[fp][1]),
        z: sorted.map(([fp]) => positions[fp][2]),
        marker: {
          size: sorted.map(([, nd]) => Math.max(4, 3 + nd.functions.length * 0.8)),
          color: sorted.map(([fp]) => uniqueDirs.indexOf(fp.split('/').slice(-3, -1).join('/'))),
          colorscale: 'Plasma', opacity: 0.9,
          line: { width: 0.5, color: '#09090b' },
        },
        text: sorted.map(([fp]) => fp.split('/').pop() ?? ''),
        textposition: 'top center',
        textfont: { size: 7, color: '#a1a1aa' },
        hovertext: sorted.map(([fp, nd]) =>
          `<b>${fp.split('/').pop()}</b><br>${nd.functions.length} functions<br>${fp.split('/').slice(-3, -1).join('/')}`
        ),
        hoverinfo: 'text', name: 'files',
      },
    ],
    layout: {
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
    },
  }
}
