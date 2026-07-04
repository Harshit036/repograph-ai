'use client'
import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useMarkdownContext } from '@/lib/markdown/utils'
import { resolveConcreteTheme } from '@/lib/markdown/theme'

let mermaidIdCounter = 0

/**
 * Render a Mermaid diagram from a fenced ```mermaid block.
 *
 * Mermaid is dynamically imported so its ~500KB payload stays out of the initial
 * bundle and only loads when a diagram is actually present. Rendering is theme-
 * aware (dark palette mirrors the app tokens; light uses Mermaid's default). If
 * the source is invalid (common mid-stream), we fall back to a plain `<pre>`.
 */
export function MermaidRenderer({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const idRef = useRef(`mermaid-${(mermaidIdCounter += 1)}`)
  const { theme } = useMarkdownContext()
  const [error, setError] = useState(false)

  useEffect(() => {
    const code = content.trim()
    if (!ref.current || !code) return
    let cancelled = false
    const concrete = resolveConcreteTheme(theme)

    import('mermaid')
      .then((m) => {
        m.default.initialize({
          startOnLoad: false,
          theme: concrete === 'dark' ? 'dark' : 'default',
          securityLevel: 'strict', // no click-handlers / injected HTML from diagram source
          themeVariables:
            concrete === 'dark'
              ? {
                  background: '#000000',
                  primaryColor: '#171717',
                  primaryTextColor: '#ececec',
                  lineColor: '#60a5fa',
                  nodeBorder: '#262626',
                  clusterBkg: '#171717',
                }
              : undefined,
        })
        return m.default.render(idRef.current, code)
      })
      .then((result) => {
        if (!cancelled && ref.current && result) {
          ref.current.innerHTML = result.svg
          setError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [content, theme])

  if (error) {
    return <pre className="md-mermaid-fallback">{content}</pre>
  }
  return <div ref={ref} className="md-mermaid" aria-label="Diagram" role="img" />
}
