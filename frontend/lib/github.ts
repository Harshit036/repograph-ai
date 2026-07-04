// Build & open GitHub deep-links for source locations (DeepWiki-style).
// The in-app code viewer was removed — clicking a source opens the file on GitHub
// at the exact ingested commit.

export interface RepoRef {
  url: string
  commitSha?: string
}

/** Build a GitHub blob URL: {repo}/blob/{sha}/{relPath}#L{line}. Returns null if unbuildable. */
export function githubBlobUrl(
  repo: RepoRef | null | undefined,
  relPath: string,
  line?: number,
): string | null {
  if (!repo?.url || !relPath) return null

  let base = repo.url.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  if (!/^https?:\/\//.test(base)) base = `https://${base}`

  const ref = (repo.commitSha ?? '').trim() || 'HEAD'
  const clean = relPath.replace(/^\/+/, '')
  const hash = line && line > 0 ? `#L${line}` : ''
  return `${base}/blob/${ref}/${clean}${hash}`
}

/** Open a source location on GitHub in a new tab. No-op if the URL can't be built. */
export function openGithubBlob(
  repo: RepoRef | null | undefined,
  relPath: string,
  line?: number,
): void {
  const url = githubBlobUrl(repo, relPath, line)
  if (url && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
