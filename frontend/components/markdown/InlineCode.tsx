'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'
import type { WithNode } from '@/lib/markdown/utils'

/**
 * Inline `code` span: rounded tinted background, mono font, theme-aware.
 * Styling lives in `markdown.css` under `.markdown code` for portability; this
 * component adds the semantic hook class and forwards any overrides.
 */
export function InlineCode({
  className,
  children,
  node,
  ...props
}: WithNode<React.HTMLAttributes<HTMLElement>>) {
  void node
  return (
    <code className={cn('md-inline-code', className)} {...props}>
      {children}
    </code>
  )
}
