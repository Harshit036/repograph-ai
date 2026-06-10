'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Search, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useWorkspace } from '@/store/workspace'

// ── Extension → syntax highlighter language ───────────────────────────────
const EXT_LANG: Record<string, string> = {
  py: 'python', js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  go: 'go', java: 'java', kt: 'kotlin', rs: 'rust', rb: 'ruby',
  php: 'php', swift: 'swift', cs: 'csharp', cpp: 'cpp', c: 'c', md: 'markdown',
}

const EXT_COLOR: Record<string, string> = {
  py: '#3b82f6', ts: '#8b5cf6', tsx: '#a78bfa', js: '#f59e0b', jsx: '#fbbf24',
  go: '#10b981', java: '#ef4444', cpp: '#f97316', c: '#fb923c', md: '#6b7280',
  rs: '#f97316', rb: '#ef4444', kt: '#8b5cf6',
}

function getExt(path: string) { return path.split('.').pop()?.toLowerCase() ?? '' }

// ── Tree node type ────────────────────────────────────────────────────────
interface TreeNode {
  name: string
  path: string       // absolute path for files, relative key for dirs
  isDir: boolean
  language: string
  size: number
  children: TreeNode[]
}

// ── Extract relative path segments from an absolute clone path ────────────
function getRelParts(filePath: string): string[] {
  const parts = filePath.replace(/\\/g, '/').split('/')
  const repoIdx = parts.indexOf('repositories')
  return repoIdx >= 0 ? parts.slice(repoIdx + 2) : parts
}

// ── Build tree from flat file list ────────────────────────────────────────
function buildTree(files: { file_path: string; language: string; size: number }[]): TreeNode[] {
  const root: Record<string, TreeNode> = {}

  for (const f of files) {
    const relParts = getRelParts(f.file_path)
    let current = root

    for (let i = 0; i < relParts.length; i++) {
      const part = relParts[i]
      const isLast = i === relParts.length - 1
      const key = relParts.slice(0, i + 1).join('/')

      if (!current[key]) {
        current[key] = {
          name: part,
          path: isLast ? f.file_path : key,
          isDir: !isLast,
          language: isLast ? f.language : '',
          size: isLast ? f.size : 0,
          children: [],
        }
      }

      if (!isLast) {
        const node = current[key]
        type WithMap = { _childMap?: Record<string, TreeNode> }
        if (!(node as unknown as WithMap)._childMap) {
          (node as unknown as WithMap)._childMap = {}
        }
        current = (node as unknown as WithMap)._childMap!
      }
    }
  }

  function toArray(map: Record<string, TreeNode>): TreeNode[] {
    return Object.values(map).map(node => {
      type WithMap = { _childMap?: Record<string, TreeNode> }
      const childMap = (node as unknown as WithMap)._childMap
      if (childMap) node.children = toArray(childMap)
      return node
    }).sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  return toArray(root)
}

// ── FileTreeNode — reads open state from parent, no local state for dirs ──
function FileTreeNode({
  node, depth, selectedPath, onSelect, openDirs, onToggleDir,
}: {
  node: TreeNode
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
  openDirs: Set<string>
  onToggleDir: (path: string) => void
}) {
  const ext = getExt(node.name)
  const color = EXT_COLOR[ext] ?? '#71717a'

  if (node.isDir) {
    const isOpen = openDirs.has(node.path)
    return (
      <div>
        <button
          onClick={() => onToggleDir(node.path)}
          className="w-full flex items-center gap-1 px-2 py-0.5 hover:bg-s2 rounded text-left"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {isOpen
            ? <ChevronDown size={12} className="text-muted shrink-0" />
            : <ChevronRight size={12} className="text-muted shrink-0" />}
          {isOpen
            ? <FolderOpen size={13} className="text-amber-400 shrink-0" />
            : <Folder size={13} className="text-amber-400 shrink-0" />}
          <span className="text-xs text-muted truncate">{node.name}</span>
        </button>
        {isOpen && node.children.map(child => (
          <FileTreeNode
            key={child.path} node={child} depth={depth + 1}
            selectedPath={selectedPath} onSelect={onSelect}
            openDirs={openDirs} onToggleDir={onToggleDir}
          />
        ))}
      </div>
    )
  }

  const isSelected = selectedPath === node.path
  return (
    <button
      data-treepath={node.path}
      onClick={() => onSelect(node.path)}
      className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-left transition-colors ${
        isSelected ? 'bg-accent/20 text-white' : 'hover:bg-s2 text-muted hover:text-white'
      }`}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
    >
      <File size={12} className="shrink-0" style={{ color }} />
      <span className="truncate font-mono text-xs">{node.name}</span>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function CodeExplorer() {
  const { currentRepo, codeViewerState } = useWorkspace()
  const [treeData, setTreeData]       = useState<TreeNode[]>([])
  const [openDirs, setOpenDirs]       = useState<Set<string>>(new Set())
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [fileLang, setFileLang]       = useState<string>('text')
  const [loadingFile, setLoadingFile] = useState(false)
  const [search, setSearch]           = useState('')
  const [treeFilter, setTreeFilter]   = useState('')
  const codeRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)

  // ── Fetch tree when repo changes ─────────────────────────────────────────
  useEffect(() => {
    if (!currentRepo?.repoId) return
    api.fileTree(currentRepo.repoId).then(files => {
      setTreeData(buildTree(files))
    }).catch(() => {})
  }, [currentRepo?.repoId])

  // ── Initialize open dirs at depth 0–1 when tree data arrives ─────────────
  useEffect(() => {
    if (!treeData.length) return
    const defaults = new Set<string>()
    function collect(nodes: TreeNode[], depth: number) {
      for (const n of nodes) {
        if (n.isDir && depth < 2) {
          defaults.add(n.path)
          collect(n.children, depth + 1)
        }
      }
    }
    collect(treeData, 0)
    setOpenDirs(defaults)
  }, [treeData])

  // ── Toggle a single directory ─────────────────────────────────────────────
  const toggleDir = useCallback((path: string) => {
    setOpenDirs(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }, [])

  // ── When selectedPath changes: expand ancestors + scroll into view ─────────
  useEffect(() => {
    if (!selectedPath) return

    const relParts = getRelParts(selectedPath)
    // e.g. for 'app/services/rag_service.py' → ['app', 'app/services']
    const ancestors = relParts.slice(0, -1).map(
      (_, i) => relParts.slice(0, i + 1).join('/')
    )

    if (ancestors.length > 0) {
      setOpenDirs(prev => {
        const next = new Set(prev)
        ancestors.forEach(p => next.add(p))
        return next
      })
    }

    // Scroll after React re-renders with the newly expanded folders
    setTimeout(() => {
      if (!treeRef.current) return
      const safe = selectedPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const el = treeRef.current.querySelector(`[data-treepath="${safe}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 60)
  }, [selectedPath])

  // ── Respond to external navigation (citation / command palette / flow tracer)
  useEffect(() => {
    if (codeViewerState.filePath && codeViewerState.filePath !== selectedPath) {
      loadFile(codeViewerState.filePath)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeViewerState.filePath])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'p') {
        e.preventDefault()
        ;(document.querySelector('[placeholder="Filter files…"]') as HTMLInputElement)?.focus()
      }
      if (e.key === 'f') {
        e.preventDefault()
        ;(document.querySelector('[placeholder="Search…"]') as HTMLInputElement)?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Scroll code viewer to target line after file loads ────────────────────
  useEffect(() => {
    if (!codeViewerState.line || !codeRef.current) return
    const lineEl = codeRef.current.querySelector(`[data-line="${codeViewerState.line}"]`)
    if (lineEl) {
      lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      const approxTop = (codeViewerState.line - 5) * 20
      codeRef.current.scrollTop = Math.max(0, approxTop)
    }
  }, [fileContent, codeViewerState.line])

  // ── Load file content ─────────────────────────────────────────────────────
  const loadFile = useCallback(async (path: string) => {
    setSelectedPath(path)
    setLoadingFile(true)
    setSearch('')
    try {
      const result = await api.fileContent(path, currentRepo?.repoId)
      setFileContent(result.content)
      setFileLang(EXT_LANG[getExt(path)] ?? result.language ?? 'text')
    } catch {
      setFileContent('// Failed to load file content.')
      setFileLang('text')
    } finally {
      setLoadingFile(false)
    }
  }, [currentRepo?.repoId])

  // ── Filter tree by name ───────────────────────────────────────────────────
  const filterNodes = useCallback(function walk(nodes: TreeNode[], q: string): TreeNode[] {
    if (!q) return nodes
    const ql = q.toLowerCase()
    return nodes.flatMap(node => {
      if (node.isDir) {
        const filtered = walk(node.children, ql)
        return filtered.length ? [{ ...node, children: filtered }] : []
      }
      return node.name.toLowerCase().includes(ql) ? [node] : []
    })
  }, [])

  // ── Inline search highlight ───────────────────────────────────────────────
  const highlightedContent = search
    ? fileContent.split('\n').map((line, i) => {
        const lineNum = i + 1
        return {
          line, lineNum,
          isTarget: codeViewerState.line === lineNum,
          matches: line.toLowerCase().includes(search.toLowerCase()),
        }
      })
    : null

  if (!currentRepo) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        Analyze a repository to browse code
      </div>
    )
  }

  const displayedTree = filterNodes(treeData, treeFilter)

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── File tree ──────────────────────────────────────────────────────── */}
      <div className="w-52 shrink-0 border-r border-border flex flex-col overflow-hidden">
        {/* Filter input */}
        <div className="px-2 py-2 border-b border-border">
          <div className="flex items-center gap-1 bg-s2 rounded px-2 py-1">
            <Search size={11} className="text-muted shrink-0" />
            <input
              className="bg-transparent text-xs text-white placeholder:text-muted outline-none w-full"
              placeholder="Filter files…"
              value={treeFilter}
              onChange={e => setTreeFilter(e.target.value)}
            />
            {treeFilter && (
              <button onClick={() => setTreeFilter('')}>
                <X size={10} className="text-muted hover:text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Tree */}
        <div ref={treeRef} className="flex-1 overflow-y-auto py-1">
          {displayedTree.map(node => (
            <FileTreeNode
              key={node.path} node={node} depth={0}
              selectedPath={selectedPath} onSelect={loadFile}
              openDirs={openDirs} onToggleDir={toggleDir}
            />
          ))}
          {displayedTree.length === 0 && (
            <p className="text-xs text-muted px-3 py-2">No files match</p>
          )}
        </div>
      </div>

      {/* ── Code viewer ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedPath ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-surface shrink-0">
              <span className="text-xs font-mono text-muted truncate flex-1">
                {getRelParts(selectedPath).join('/')}
              </span>
              <div className="flex items-center gap-1 bg-s2 rounded px-2 py-0.5">
                <Search size={11} className="text-muted shrink-0" />
                <input
                  className="bg-transparent text-xs text-white placeholder:text-muted outline-none w-24"
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')}>
                    <X size={11} className="text-muted hover:text-white" />
                  </button>
                )}
              </div>
            </div>

            {/* Code content */}
            <div ref={codeRef} className="flex-1 overflow-auto text-xs">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full text-muted text-sm">Loading…</div>
              ) : highlightedContent ? (
                <table className="w-full border-collapse font-mono text-xs">
                  <tbody>
                    {highlightedContent.map(({ line, lineNum, isTarget, matches }) => (
                      <tr
                        key={lineNum}
                        data-line={lineNum}
                        className={isTarget ? 'bg-accent/20' : matches ? 'bg-yellow-500/10' : ''}
                      >
                        <td className="select-none text-right pr-3 pl-2 text-muted w-10 shrink-0">{lineNum}</td>
                        <td className="pr-4 text-green-300 whitespace-pre">{line || ' '}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <SyntaxHighlighter
                  language={fileLang}
                  style={vscDarkPlus}
                  showLineNumbers
                  wrapLines
                  lineProps={(lineNum) => ({
                    'data-line': lineNum,
                    style: lineNum === codeViewerState.line
                      ? { backgroundColor: 'rgba(96,165,250,0.2)', display: 'block' }
                      : { display: 'block' },
                  })}
                  customStyle={{ margin: 0, padding: '8px 0', background: 'transparent', fontSize: '11px' }}
                >
                  {fileContent}
                </SyntaxHighlighter>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted gap-2">
            <File size={32} className="opacity-20" />
            <p className="text-sm">Select a file to view its code</p>
            <p className="text-xs opacity-60">or click a citation in chat</p>
          </div>
        )}
      </div>
    </div>
  )
}
