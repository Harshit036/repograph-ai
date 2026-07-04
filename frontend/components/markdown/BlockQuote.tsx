'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'
import type { WithNode } from '@/lib/markdown/utils'

/**
 * Blockquote: left accent border, subtle tinted background, comfortable spacing.
 * Visual styling is defined in `markdown.css` (`.markdown blockquote`).
 */
export function BlockQuote({
  className,
  children,
  node,
  ...props
}: WithNode<React.BlockquoteHTMLAttributes<HTMLQuoteElement>>) {
  void node
  return (
    <blockquote className={cn('md-blockquote', className)} {...props}>
      {children}
    </blockquote>
  )
}
