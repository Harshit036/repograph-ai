'use client'
import * as React from 'react'
import { useDeferredValue } from 'react'
import type { Element, ElementContent } from 'hast'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMarkdownContext } from '@/lib/markdown/utils'
import { useShikiHighlighter } from '@/hooks/useShikiHighlighter'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { normalizeLang } from '@/lib/markdown/syntaxHighlighting'
import { MermaidRenderer } from './MermaidRenderer'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** Pull the raw code text + language from the `<pre><code>` hast subtree. */
function extractCode(node?: Element): { code: string; lang?: string } {
  const codeEl = node?.children?.find(
    (c): c is Element => c.type === 'element' && c.tagName === 'code',
  )
  const classNames = codeEl?.properties?.className
  const classList = Array.isArray(classNames)
    ? classNames.map(String)
    : typeof classNames === 'string'
      ? classNames.split(' ')
      : []
  const lang = classList
    .find((c) => c.startsWith('language-'))
    ?.replace('language-', '')

  const collect = (n: ElementContent): string => {
    if (n.type === 'text') return n.value
    if (n.type === 'element') return n.children.map(collect).join('')
    return ''
  }
  const code = (codeEl?.children ?? []).map(collect).join('')
  return { code, lang }
}

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  node?: Element
}

/**
 * Fenced code block: language badge, copy button, Shiki highlighting, optional
 * line numbers / soft-wrap, horizontal scroll. Mermaid blocks are delegated to
 * {@link MermaidRenderer}.
 *
 * Streaming: `code` is read from the hast node (always current), while the value
 * fed to Shiki is deferred (`useDeferredValue`) so highlighting lags behind fast
 * token updates instead of thrashing. Until a highlight resolves we render an
 * escaped plaintext `<pre>` with identical layout — so text is never missing and
 * there is no flicker when the highlighted version swaps in.
 */
export function CodeBlock({ node, className, ...props }: CodeBlockProps) {
  const { features } = useMarkdownContext()
  const { code, lang } = extractCode(node)
  const normalized = normalizeLang(lang)
  const { copied, copy } = useCopyToClipboard()

  const deferredCode = useDeferredValue(code)
  const { html } = useShikiHighlighter(
    deferredCode,
    lang,
    features.syntaxHighlighting,
  )

  if (features.mermaid && normalized === 'mermaid') {
    return <MermaidRenderer content={code} />
  }

  const showHighlighted = features.syntaxHighlighting && html != null
  const label = lang ? lang : 'code'

  return (
    <div
      className={cn(
        'md-code',
        features.lineNumbers && 'md-code--numbered',
        features.lineWrap && 'md-code--wrap',
      )}
      role="region"
      aria-label={`Code block${lang ? `: ${lang}` : ''}`}
    >
      <div className="md-code__bar">
        <span className="md-code__lang">{label}</span>
        {features.copyButton && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => copy(code)}
                  aria-label={copied ? 'Copied' : 'Copy code'}
                  className="md-code__copy"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-success" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy to clipboard</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="md-code__body">
        {showHighlighted ? (
          // Shiki output is trusted (generated from escaped source) — safe to inject.
          <div className="md-code__shiki" dangerouslySetInnerHTML={{ __html: html! }} />
        ) : (
          <pre className={cn('md-code__fallback', className)} {...props}>
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
