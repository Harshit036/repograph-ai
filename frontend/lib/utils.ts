import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * `cn` — the shadcn/ui class-merge helper.
 * Combines conditional class values (clsx) and de-dupes conflicting Tailwind
 * utilities (tailwind-merge) so later classes win predictably.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
