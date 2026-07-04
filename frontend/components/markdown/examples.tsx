'use client'
/**
 * Usage examples for the Markdown rendering system across different product
 * surfaces. These are reference snippets — the same `<MarkdownRenderer>` powers
 * every case; only the `features` and injected `components` differ.
 *
 * Not imported by the app at runtime; kept alongside the library as living docs.
 */
import { useMemo } from 'react'
import type { Components } from 'react-markdown'
import type { MarkdownFeatures } from '@/types/markdown'
import { MarkdownRenderer } from './index'

/* 1. AI Chat — streaming answer with citation chips injected as an `a` override. */
const CHAT_FEATURES: MarkdownFeatures = { streaming: true }

export function AiChatMessage({
  content,
  onCite,
}: {
  content: string
  onCite: (sourceId: number) => void
}) {
  const components = useMemo<Partial<Components>>(
    () => ({
      a: ({ href, children }) => {
        if (typeof href === 'string' && href.startsWith('#source-')) {
          const id = parseInt(href.replace('#source-', ''), 10)
          return (
            <button className="citation-chip" onClick={() => onCite(id)}>
              {children}
            </button>
          )
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
            {children}
          </a>
        )
      },
    }),
    [onCite],
  )
  return (
    <MarkdownRenderer content={content} theme="dark" features={CHAT_FEATURES} components={components} />
  )
}

/* 2. Blog / Article — anchored headings + image zoom, math off. */
const ARTICLE_FEATURES: MarkdownFeatures = {
  headingAnchors: true,
  imageZoom: true,
  math: false,
  mermaid: false,
}

export function ArticleBody({ body }: { body: string }) {
  return (
    <article className="mx-auto max-w-2xl">
      <MarkdownRenderer content={body} features={ARTICLE_FEATURES} />
    </article>
  )
}

/* 3. Documentation — everything on, with line numbers for code. */
const DOCS_FEATURES: MarkdownFeatures = {
  lineNumbers: true,
  headingAnchors: true,
  math: true,
  mermaid: true,
}

export function DocumentationPage({ docs }: { docs: string }) {
  return <MarkdownRenderer content={docs} features={DOCS_FEATURES} />
}

/* 4. Comments — locked down: no HTML, no images, no math/mermaid/copy. */
const COMMENT_FEATURES: MarkdownFeatures = {
  allowHtml: false,
  images: false,
  math: false,
  mermaid: false,
  copyButton: false,
  syntaxHighlighting: false,
}

export function UserComment({ text }: { text: string }) {
  return (
    <div className="text-sm">
      <MarkdownRenderer content={text} features={COMMENT_FEATURES} />
    </div>
  )
}

/* 5. CMS / Release notes — trusted authored HTML allowed (still sanitised). */
const CMS_FEATURES: MarkdownFeatures = { allowHtml: true, imageZoom: true }

export function ReleaseNotes({ markdown }: { markdown: string }) {
  return <MarkdownRenderer content={markdown} features={CMS_FEATURES} />
}
