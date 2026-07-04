'use client'
import * as React from 'react'
import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { MarkdownContext, resolveFeatures } from '@/lib/markdown/utils'
import { buildPlugins } from '@/lib/markdown/plugins'
import { baseComponents } from '@/lib/markdown/components'
import { themeAttr } from '@/lib/markdown/theme'
import type { MarkdownRendererProps } from '@/types/markdown'

/**
 * The single public entry point for rendering Markdown.
 *
 * Business-agnostic by design: it knows nothing about where the Markdown comes
 * from. App-specific behaviour is injected via `components` (per-element
 * overrides) and the `remarkPlugins` / `rehypePlugins` extension arrays.
 *
 * ### Performance
 * - Plugin arrays and the merged component map are memoised, so streaming token
 *   updates only re-parse the content string — they never rebuild config.
 * - The component is wrapped in `React.memo`; pass a **stable** `features` object
 *   (hoist it to module scope or `useMemo` it) to get the full benefit.
 * - Per-block Shiki highlighting is cached (see `syntaxHighlighting.ts`), so
 *   completed code blocks are never re-highlighted during a stream.
 *
 * @example
 * ```tsx
 * <MarkdownRenderer content={markdown} />
 * ```
 */
function MarkdownRendererImpl({
  content,
  features,
  theme = 'system',
  className,
  components,
  remarkPlugins,
  rehypePlugins,
  'aria-label': ariaLabel,
}: MarkdownRendererProps) {
  const resolved = useMemo(() => resolveFeatures(features), [features])

  const { remarkPlugins: remark, rehypePlugins: rehype } = useMemo(
    () => buildPlugins(resolved, remarkPlugins, rehypePlugins),
    [resolved, remarkPlugins, rehypePlugins],
  )

  const mergedComponents = useMemo(
    () => ({ ...baseComponents, ...components }),
    [components],
  )

  const ctx = useMemo(() => ({ features: resolved, theme }), [resolved, theme])

  return (
    <MarkdownContext.Provider value={ctx}>
      <div
        className={cn('markdown', className)}
        aria-label={ariaLabel}
        {...themeAttr(theme)}
      >
        <ReactMarkdown
          remarkPlugins={remark}
          rehypePlugins={rehype}
          components={mergedComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    </MarkdownContext.Provider>
  )
}

export const MarkdownRenderer = memo(MarkdownRendererImpl)
MarkdownRenderer.displayName = 'MarkdownRenderer'
