export interface D3TreeNode {
  name: string
  attributes?: Record<string, string | number>
  children?: D3TreeNode[]
  _isFile?: boolean
  _ext?: string
  _color?: string
}

interface FlatTree {
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

export function flatToD3Tree(data: FlatTree): D3TreeNode {
  const nodeMap = new Map<string, D3TreeNode & { _id: string; _parent: string }>()

  for (let i = 0; i < data.ids.length; i++) {
    const node: D3TreeNode & { _id: string; _parent: string } = {
      _id: data.ids[i],
      _parent: data.parents[i],
      name: data.labels[i],
      _isFile: data.is_file[i],
      _ext: data.extensions[i],
      _color: data.colors[i],
      attributes: data.is_file[i]
        ? { chunks: data.chunks[i], fns: data.functions[i] }
        : undefined,
      children: [],
    }
    nodeMap.set(data.ids[i], node)
  }

  // Build tree by linking children to parents
  const roots: (D3TreeNode & { _id: string; _parent: string })[] = []
  nodeMap.forEach(node => {
    if (node._parent && nodeMap.has(node._parent)) {
      const parent = nodeMap.get(node._parent)!
      if (!parent.children) parent.children = []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // Sort: directories first, then alphabetically
  const sortChildren = (n: D3TreeNode) => {
    if (!n.children) return
    n.children.sort((a, b) => {
      if (!!a._isFile !== !!b._isFile) return a._isFile ? 1 : -1
      return a.name.localeCompare(b.name)
    })
    n.children.forEach(sortChildren)
  }

  // If multiple roots, wrap in a virtual root
  const root: D3TreeNode = roots.length === 1
    ? roots[0]
    : { name: 'root', children: roots }

  sortChildren(root)
  return root
}
