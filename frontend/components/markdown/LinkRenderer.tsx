'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { isExternalUrl, useMarkdownContext, type WithNode } from '@/lib/markdown/utils'

/**
 * Anchor renderer.
 *
 * Security: external links always get `rel="noopener noreferrer"` (prevents the
 * opened page from accessing `window.opener`) and open in a new tab. We never
 * trust an author-supplied `target`. `javascript:` URIs are already stripped by
 * rehype-sanitize's protocol allowlist upstream.
 *
 * Accessibility: external links get an `aria-label` suffix so screen-reader
 * users know a new tab will open.
 */
export function LinkRenderer({
  href,
  children,
  className,
  node,
  ...props
}: WithNode<React.AnchorHTMLAttributes<HTMLAnchorElement>>) {
  void node
  const { features } = useMarkdownContext()
  const external = features.externalLinks && isExternalUrl(href)

  const label =
    external && typeof props['aria-label'] !== 'string'
      ? `${typeof children === 'string' ? children : 'link'} (opens in a new tab)`
      : props['aria-label']

  return (
    <a
      href={href}
      className={cn('md-link', className)}
      {...(external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
      {...props}
      aria-label={label}
    >
      {children}
    </a>
  )
}
