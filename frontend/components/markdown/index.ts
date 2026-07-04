/**
 * Public API of the Markdown rendering system.
 *
 * Consumers should import from here:
 *   import { MarkdownRenderer } from '@/components/markdown'
 *
 * The individual leaf components are also exported for advanced composition
 * (e.g. rendering a standalone code block or formula outside of Markdown).
 */
export { MarkdownRenderer } from './MarkdownRenderer'

// Leaf components — reusable in isolation.
export { CodeBlock } from './CodeBlock'
export { InlineCode } from './InlineCode'
export { Table } from './Table'
export { ImageRenderer } from './ImageRenderer'
export { LinkRenderer } from './LinkRenderer'
export { BlockQuote } from './BlockQuote'
export { MermaidRenderer } from './MermaidRenderer'
export { MathRenderer } from './MathRenderer'
export { createHeading } from './Heading'
export { UnorderedList, OrderedList, ListItem } from './List'

// Types & helpers.
export type {
  MarkdownRendererProps,
  MarkdownFeatures,
  MarkdownTheme,
  ResolvedFeatures,
} from '@/types/markdown'
export { DEFAULT_FEATURES, resolveFeatures } from '@/lib/markdown/utils'
export { sanitizeSchema } from '@/lib/markdown/sanitize'
