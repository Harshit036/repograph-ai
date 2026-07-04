import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Components } from 'react-markdown'
import { MarkdownRenderer } from '@/components/markdown'

// Keep Shiki out of the test env: the fallback <pre> is rendered instead.
vi.mock('@/hooks/useShikiHighlighter', () => ({
  useShikiHighlighter: () => ({ html: null, loading: false }),
}))

describe('MarkdownRenderer — GFM', () => {
  it('renders headings, paragraphs and emphasis', () => {
    render(<MarkdownRenderer content={'# Title\n\nSome **bold** text.'} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument()
    expect(screen.getByText('bold').tagName).toBe('STRONG')
  })

  it('renders GFM tables inside a scrollable region', () => {
    const md = '| A | B |\n| - | - |\n| 1 | 2 |'
    render(<MarkdownRenderer content={md} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeInTheDocument()
  })

  it('renders task lists with checkboxes', () => {
    render(<MarkdownRenderer content={'- [x] done\n- [ ] todo'} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    expect(boxes[0]).toBeChecked()
    expect(boxes[1]).not.toBeChecked()
  })

  it('renders inline vs block code differently', () => {
    const { container } = render(
      <MarkdownRenderer content={'Inline `x` and:\n\n```js\nconst y = 1\n```'} />,
    )
    expect(container.querySelector('.md-inline-code')).toBeInTheDocument()
    expect(container.querySelector('.md-code')).toBeInTheDocument()
  })
})

describe('MarkdownRenderer — security', () => {
  it('does not render raw HTML by default', () => {
    const { container } = render(
      <MarkdownRenderer content={'Hi <script>window.__pwned=1</script><img src=x onerror="alert(1)">'} />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img[onerror]')).toBeNull()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__pwned).toBeUndefined()
  })

  it('strips dangerous tags even when allowHtml is enabled', () => {
    const { container } = render(
      <MarkdownRenderer
        content={'<script>window.__pwned2=1</script><p>safe html</p>'}
        features={{ allowHtml: true }}
      />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText('safe html')).toBeInTheDocument()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__pwned2).toBeUndefined()
  })
})

describe('MarkdownRenderer — links', () => {
  it('opens external links safely in a new tab', () => {
    render(<MarkdownRenderer content={'[site](https://example.com)'} />)
    const link = screen.getByRole('link', { name: /site/i })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not add target to internal links', () => {
    render(<MarkdownRenderer content={'[docs](/docs)'} />)
    const link = screen.getByRole('link', { name: 'docs' })
    expect(link).not.toHaveAttribute('target')
  })
})

describe('MarkdownRenderer — extensibility', () => {
  it('lets callers override an element (business injection)', () => {
    const components: Partial<Components> = {
      a: ({ children }) => <span data-testid="custom-link">{children}</span>,
    }
    render(<MarkdownRenderer content={'[x](https://e.com)'} components={components} />)
    expect(screen.getByTestId('custom-link')).toHaveTextContent('x')
  })
})

describe('MarkdownRenderer — math', () => {
  it('renders LaTeX with KaTeX when enabled', () => {
    const { container } = render(<MarkdownRenderer content={'$a^2 + b^2$'} />)
    expect(container.querySelector('.katex')).toBeInTheDocument()
  })

  it('does not render KaTeX when math is disabled', () => {
    const { container } = render(
      <MarkdownRenderer content={'$a^2 + b^2$'} features={{ math: false }} />,
    )
    expect(container.querySelector('.katex')).toBeNull()
  })
})
