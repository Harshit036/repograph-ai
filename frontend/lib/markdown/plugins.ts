import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeSanitize from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import type { PluggableList } from 'unified'
import type { ResolvedFeatures } from '@/types/markdown'
import { sanitizeSchema } from './sanitize'

/**
 * Build the remark + rehype plugin arrays for a given feature set.
 *
 * ## Pipeline & ordering (security-critical)
 * react-markdown runs: remark plugins → mdast→hast → rehype plugins.
 *
 * remark:  gfm (tables/strikethrough/task-lists/autolinks) → math (optional)
 * rehype:  [raw?] → sanitize → katex(optional)
 *
 * - `rehype-raw` (only when `allowHtml`) parses embedded HTML into the tree, so
 *   it must come first — before sanitisation can scrub it.
 * - `rehype-sanitize` always runs (defence in depth) and is placed **before**
 *   `rehype-katex`: it cleans the math *placeholder* nodes, then KaTeX expands
 *   them into trusted markup that (correctly) bypasses re-sanitisation.
 *
 * Caller-supplied plugins are appended last so they can extend, never bypass,
 * the security stage.
 */
export function buildPlugins(
  features: ResolvedFeatures,
  extraRemark: PluggableList = [],
  extraRehype: PluggableList = [],
): { remarkPlugins: PluggableList; rehypePlugins: PluggableList } {
  const remarkPlugins: PluggableList = [remarkGfm]
  if (features.math) remarkPlugins.push(remarkMath)

  const rehypePlugins: PluggableList = []
  if (features.allowHtml) rehypePlugins.push(rehypeRaw)
  rehypePlugins.push([rehypeSanitize, sanitizeSchema])
  if (features.math) rehypePlugins.push(rehypeKatex)

  return {
    remarkPlugins: [...remarkPlugins, ...extraRemark],
    rehypePlugins: [...rehypePlugins, ...extraRehype],
  }
}
