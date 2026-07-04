import { describe, it, expect } from 'vitest'
import {
  slugify,
  isExternalUrl,
  resolveFeatures,
  childrenToString,
  DEFAULT_FEATURES,
} from '@/lib/markdown/utils'
import { normalizeLang } from '@/lib/markdown/syntaxHighlighting'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })
  it('strips punctuation and collapses separators', () => {
    expect(slugify('  Foo: Bar!! _baz_ ')).toBe('foo-bar-baz')
  })
  it('handles empty input', () => {
    expect(slugify('')).toBe('')
  })
})

describe('isExternalUrl', () => {
  it('treats absolute cross-origin URLs as external', () => {
    expect(isExternalUrl('https://example.com/x')).toBe(true)
  })
  it('treats hash, relative and root links as internal', () => {
    expect(isExternalUrl('#section')).toBe(false)
    expect(isExternalUrl('/docs')).toBe(false)
    expect(isExternalUrl('./page')).toBe(false)
  })
  it('treats mailto/tel as internal (not new-tab)', () => {
    expect(isExternalUrl('mailto:a@b.com')).toBe(false)
    expect(isExternalUrl('tel:+123')).toBe(false)
  })
  it('handles undefined', () => {
    expect(isExternalUrl(undefined)).toBe(false)
  })
})

describe('resolveFeatures', () => {
  it('returns defaults when nothing passed', () => {
    expect(resolveFeatures()).toEqual(DEFAULT_FEATURES)
  })
  it('merges partial overrides over defaults', () => {
    const r = resolveFeatures({ math: false, streaming: true })
    expect(r.math).toBe(false)
    expect(r.streaming).toBe(true)
    expect(r.syntaxHighlighting).toBe(true) // untouched default
  })
})

describe('childrenToString', () => {
  it('flattens nested react children to text', () => {
    const node = { props: { children: ['Hello ', { props: { children: 'World' } }] } }
    expect(childrenToString(node as never)).toBe('Hello World')
  })
})

describe('normalizeLang', () => {
  it('resolves aliases', () => {
    expect(normalizeLang('js')).toBe('javascript')
    expect(normalizeLang('py')).toBe('python')
    expect(normalizeLang('TS')).toBe('typescript')
  })
  it('falls back to text for empty', () => {
    expect(normalizeLang('')).toBe('text')
    expect(normalizeLang(undefined)).toBe('text')
  })
})
