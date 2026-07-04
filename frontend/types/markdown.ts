import type { Components } from 'react-markdown'
import type { PluggableList } from 'unified'

/**
 * Feature flags for the Markdown renderer.
 *
 * Every flag is optional — {@link resolveFeatures} merges the caller's partial
 * object over {@link DEFAULT_FEATURES}. This keeps the public API additive:
 * new features can be introduced without breaking existing call sites.
 */
export interface MarkdownFeatures {
  /** Syntax-highlight fenced code blocks with Shiki. */
  syntaxHighlighting?: boolean
  /** Show a copy-to-clipboard button on code blocks. */
  copyButton?: boolean
  /** Render gutter line numbers in code blocks. */
  lineNumbers?: boolean
  /** Soft-wrap long lines instead of horizontal scroll. */
  lineWrap?: boolean
  /** Render `$inline$` / `$$block$$` LaTeX with KaTeX. */
  math?: boolean
  /** Render ```mermaid fenced blocks as diagrams. */
  mermaid?: boolean
  /** Enable GitHub-flavoured tables (part of remark-gfm). */
  tables?: boolean
  /** Render images (when false, images are dropped). */
  images?: boolean
  /** Lazy-load images (`loading="lazy"`, `decoding="async"`). */
  lazyImages?: boolean
  /** Click an image to open it in a zoom dialog. */
  imageZoom?: boolean
  /** External links open in a new tab with `rel="noopener noreferrer"`. */
  externalLinks?: boolean
  /**
   * Optimise for streaming input (AI token streams): defer syntax highlighting
   * of the final, possibly-incomplete code fence to avoid flicker/thrash.
   */
  streaming?: boolean
  /**
   * Allow raw HTML embedded in the Markdown source. Off by default for safety.
   * When on, the pipeline runs rehype-raw followed by rehype-sanitize so the
   * HTML is still scrubbed. Never enable this for untrusted user input unless
   * you have reviewed {@link sanitizeSchema}.
   */
  allowHtml?: boolean
  /** Give headings slugged `id`s and a focusable anchor link. */
  headingAnchors?: boolean
}

export type MarkdownTheme = 'light' | 'dark' | 'system'

/** Fully-resolved features — no optional fields. */
export type ResolvedFeatures = Required<MarkdownFeatures>

/**
 * Props for {@link MarkdownRenderer}, the single public entry point.
 *
 * The renderer is deliberately business-agnostic: app-specific behaviour is
 * injected via {@link components} (per-element overrides) and the plugin arrays,
 * never hard-coded inside the library.
 */
export interface MarkdownRendererProps {
  /** The Markdown source string. */
  content: string
  /** Feature toggles (merged over defaults). */
  features?: MarkdownFeatures
  /** Colour theme. `'system'` follows `prefers-color-scheme`. */
  theme?: MarkdownTheme
  /** Extra classes for the root `<div className="markdown">`. */
  className?: string
  /**
   * Per-element component overrides passed straight to react-markdown. Use this
   * to inject business behaviour (e.g. citation chips) without forking the lib.
   */
  components?: Partial<Components>
  /** Additional remark plugins appended after the built-in set. */
  remarkPlugins?: PluggableList
  /** Additional rehype plugins appended after the built-in set. */
  rehypePlugins?: PluggableList
  /** Accessible label for the rendered region. */
  'aria-label'?: string
}

/**
 * Context shared with every leaf component so they can react to the active
 * theme and feature set without prop-drilling through react-markdown.
 */
export interface MarkdownRenderContext {
  features: ResolvedFeatures
  theme: MarkdownTheme
}
