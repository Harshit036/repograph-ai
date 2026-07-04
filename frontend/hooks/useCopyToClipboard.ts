'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

interface UseCopyToClipboard {
  copied: boolean
  copy: (text: string) => Promise<boolean>
}

/**
 * Copy text to the clipboard and expose a transient `copied` flag for showing a
 * "Copied!" confirmation. Falls back to a hidden-textarea `execCommand` copy for
 * non-secure contexts where `navigator.clipboard` is unavailable.
 */
export function useCopyToClipboard(resetMs = 1500): UseCopyToClipboard {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(
    async (text: string) => {
      let ok = false
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
          ok = true
        } else {
          ok = legacyCopy(text)
        }
      } catch {
        ok = legacyCopy(text)
      }
      if (ok) {
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), resetMs)
      }
      return ok
    },
    [resetMs],
  )

  return { copied, copy }
}

function legacyCopy(text: string): boolean {
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'absolute'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
