import type { MarkdownTheme } from '@/types/markdown'

/**
 * Shiki theme names used for the light and dark palettes. Shiki's dual-theme
 * output emits CSS variables for both, and we toggle them with a class/media
 * query — so switching theme never re-runs the highlighter.
 */
export const SHIKI_THEMES = {
  light: 'github-light',
  dark: 'github-dark',
} as const

export type ShikiThemeName = (typeof SHIKI_THEMES)[keyof typeof SHIKI_THEMES]

/**
 * Resolve `'system'` to a concrete `'light' | 'dark'` for consumers (e.g.
 * Mermaid) that cannot express "both". On the server we default to dark to
 * match this app's default `<html class="dark">`; the client effect corrects it.
 */
export function resolveConcreteTheme(theme: MarkdownTheme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return 'dark'
}

/**
 * The `data-theme` attribute value we stamp on the markdown root so scoped CSS
 * (and Shiki's variable toggles) know which palette to show. `'system'` emits
 * no attribute, letting the `prefers-color-scheme` media query decide.
 */
export function themeAttr(theme: MarkdownTheme): Record<string, string> {
  return theme === 'system' ? {} : { 'data-theme': theme }
}
