'use client'
import * as React from 'react'
import { LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  childrenToString,
  slugify,
  useMarkdownContext,
  type WithNode,
} from '@/lib/markdown/utils'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/**
 * Heading renderer factory. Optionally assigns a slugged `id` and renders a
 * focusable anchor link (visible on hover/focus) so sections can be deep-linked.
 * The anchor is keyboard-reachable and labelled for screen readers.
 */
export function createHeading(level: HeadingLevel) {
  const Tag = `h${level}` as const

  function Heading({
    className,
    children,
    node,
    ...props
  }: WithNode<React.HTMLAttributes<HTMLHeadingElement>>) {
    void node
    const { features } = useMarkdownContext()
    const id = features.headingAnchors ? slugify(childrenToString(children)) : undefined

    return (
      <Tag id={id} className={cn('md-heading group', className)} {...props}>
        {children}
        {features.headingAnchors && id && (
          <a
            href={`#${id}`}
            className="md-heading-anchor"
            aria-label="Link to this section"
            tabIndex={0}
          >
            <LinkIcon className="h-[0.7em] w-[0.7em]" aria-hidden />
          </a>
        )}
      </Tag>
    )
  }

  Heading.displayName = `Heading${level}`
  return Heading
}
