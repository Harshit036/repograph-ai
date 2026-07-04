import type { Components } from 'react-markdown'
import { createHeading } from '@/components/markdown/Heading'
import { LinkRenderer } from '@/components/markdown/LinkRenderer'
import { ImageRenderer } from '@/components/markdown/ImageRenderer'
import { BlockQuote } from '@/components/markdown/BlockQuote'
import { InlineCode } from '@/components/markdown/InlineCode'
import { CodeBlock } from '@/components/markdown/CodeBlock'
import {
  UnorderedList,
  OrderedList,
  ListItem,
} from '@/components/markdown/List'
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableCell,
} from '@/components/markdown/Table'

/**
 * The base element→component mapping handed to react-markdown.
 *
 * `code` renders inline code; block code is rendered by the `pre` override
 * (`CodeBlock`), which reads the raw source from the hast node and discards the
 * default rendered children — so the two never conflict.
 *
 * Callers merge their own overrides on top of this map to inject business
 * behaviour (e.g. citation chips replacing `a`) without modifying the library.
 */
export const baseComponents: Partial<Components> = {
  h1: createHeading(1),
  h2: createHeading(2),
  h3: createHeading(3),
  h4: createHeading(4),
  h5: createHeading(5),
  h6: createHeading(6),
  a: LinkRenderer,
  img: ImageRenderer,
  blockquote: BlockQuote,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  table: Table,
  thead: TableHead,
  th: TableHeaderCell,
  td: TableCell,
  code: InlineCode,
  pre: CodeBlock,
}
