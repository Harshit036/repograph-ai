import { createContext, useContext } from 'react'
import type {
  MarkdownFeatures,
  ResolvedFeatures,
  MarkdownRenderContext,
} from '@/types/markdown'

/**
 * Default feature set. Sensible, safe defaults: highlighting + copy + gfm +
 * math + mermaid on; raw HTML, zoom, line numbers, streaming off.
 */
export const DEFAULT_FEATURES: ResolvedFeatures = {
  syntaxHighlighting: true,
  copyButton: true,
  lineNumbers: false,
  lineWrap: false,
  math: true,
  mermaid: true,
  tables: true,
  images: true,
  lazyImages: true,
  imageZoom: false,
  externalLinks: true,
  streaming: false,
  allowHtml: false,
  headingAnchors: false,
}

/** Merge a caller's partial features over the defaults. */
export function resolveFeatures(features?: MarkdownFeatures): ResolvedFeatures {
  if (!features) return DEFAULT_FEATURES
  return { ...DEFAULT_FEATURES, ...features }
}

/**
 * Slugify heading text into a URL-safe `id`. Mirrors GitHub's algorithm closely
 * enough for anchor links: lowercase, strip non-word chars, collapse spaces to
 * hyphens.
 */
export function slugify(input: string): string {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Is this href external (should open in a new tab)? Same-origin, relative,
 * hash and mailto/tel links are treated as internal.
 */
export function isExternalUrl(href?: string): boolean {
  if (!href) return false
  if (/^(#|\/|\.|mailto:|tel:)/.test(href)) return false
  if (/^https?:\/\//i.test(href)) {
    if (typeof window === 'undefined') return true
    try {
      return new URL(href).origin !== window.location.origin
    } catch {
      return false
    }
  }
  // Protocol-relative or other schemes: treat anything with `://` as external.
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(href)
}

/**
 * Extract the plain-text content of a react-markdown `children` prop. Used for
 * heading slugs and code extraction where we need the raw string.
 */
export function childrenToString(children: React.ReactNode): string {
  if (children == null || children === false || children === true) return ''
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }
  if (Array.isArray(children)) return children.map(childrenToString).join('')
  if (typeof children === 'object' && 'props' in (children as object)) {
    // React element — recurse into its children.
    return childrenToString(
      (children as { props?: { children?: React.ReactNode } }).props?.children,
    )
  }
  return ''
}

/**
 * react-markdown passes a hast `node` prop to every component override. When we
 * spread props onto a real DOM element we must drop it, or React warns about an
 * unknown attribute. Components accept this widened prop type and destructure
 * `node` away.
 */
export type WithNode<T> = T & { node?: unknown }

// ── Render context ────────────────────────────────────────────────────────────

export const MarkdownContext = createContext<MarkdownRenderContext>({
  features: DEFAULT_FEATURES,
  theme: 'system',
})

/** Read the active feature set + theme from within a leaf component. */
export function useMarkdownContext(): MarkdownRenderContext {
  return useContext(MarkdownContext)
}
