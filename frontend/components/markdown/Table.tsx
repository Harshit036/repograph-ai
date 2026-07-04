'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'
import type { WithNode } from '@/lib/markdown/utils'

/**
 * Table renderer. Wraps the `<table>` in a horizontally-scrollable container so
 * wide tables never break the page layout on mobile. The header is sticky within
 * that scroll container. `role="region"` + `tabIndex` make the scrollable area
 * keyboard-reachable (WCAG scrollable-region requirement).
 */
export function Table({
  className,
  children,
  node,
  ...props
}: WithNode<React.TableHTMLAttributes<HTMLTableElement>>) {
  void node
  return (
    <div
      className="md-table-wrap"
      role="region"
      aria-label="Table"
      tabIndex={0}
    >
      <table className={cn('md-table', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export function TableHead({
  node,
  ...props
}: WithNode<React.HTMLAttributes<HTMLTableSectionElement>>) {
  void node
  return <thead className="md-thead" {...props} />
}

export function TableHeaderCell({
  node,
  ...props
}: WithNode<React.ThHTMLAttributes<HTMLTableCellElement>>) {
  void node
  return <th className="md-th" {...props} />
}

export function TableCell({
  node,
  ...props
}: WithNode<React.TdHTMLAttributes<HTMLTableCellElement>>) {
  void node
  return <td className="md-td" {...props} />
}
