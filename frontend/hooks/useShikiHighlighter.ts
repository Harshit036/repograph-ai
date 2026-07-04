'use client'
import { useEffect, useState } from 'react'
import { highlightCode } from '@/lib/markdown/syntaxHighlighting'

interface UseShikiResult {
  /** Highlighted dual-theme HTML, or `null` while pending / when disabled. */
  html: string | null
  /** True until the first successful highlight resolves. */
  loading: boolean
}

/**
 * Highlight a code string with Shiki, off the render path.
 *
 * When `enabled` is false (e.g. syntax highlighting turned off, or the block is
 * the still-streaming final fence) the hook stays inert and the caller renders a
 * plain `<pre>` fallback — avoiding flicker during token streaming.
 *
 * Stale async results are discarded via a per-effect `cancelled` guard, so rapid
 * updates (streaming) can never paint an out-of-date highlight.
 */
export function useShikiHighlighter(
  code: string,
  lang: string | undefined,
  enabled: boolean,
): UseShikiResult {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setHtml(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    highlightCode(code, lang)
      .then((result) => {
        if (!cancelled) {
          setHtml(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHtml(null)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [code, lang, enabled])

  return { html, loading }
}
