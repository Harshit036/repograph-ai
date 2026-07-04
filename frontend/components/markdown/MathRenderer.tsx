'use client'
import * as React from 'react'
import { useMemo } from 'react'
import katex from 'katex'
import { cn } from '@/lib/utils'

/**
 * Standalone KaTeX renderer for a raw LaTeX string.
 *
 * Inside Markdown, math is handled automatically by the remark-math →
 * rehype-katex pipeline (see `plugins.ts`). This component is the reusable
 * escape hatch for rendering a formula programmatically anywhere in the app.
 *
 * KaTeX runs with `trust: false` (default) and `throwOnError: false`, so
 * malformed input degrades to a visible error string rather than crashing, and
 * `\href`/`\htmlClass` injection vectors stay disabled.
 */
export function MathRenderer({
  math,
  display = false,
  className,
}: {
  math: string
  display?: boolean
  className?: string
}) {
  const html = useMemo(
    () =>
      katex.renderToString(math, {
        displayMode: display,
        throwOnError: false,
        output: 'htmlAndMathml',
      }),
    [math, display],
  )

  const Tag = display ? 'div' : 'span'
  return (
    <Tag
      className={cn(display && 'md-math-display', className)}
      // KaTeX output is generated from `math` with trust disabled — safe to inject.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
