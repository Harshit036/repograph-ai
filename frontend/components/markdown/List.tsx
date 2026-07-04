'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'
import type { WithNode } from '@/lib/markdown/utils'

/**
 * List renderers. GFM task lists arrive as `<li>` containing a disabled
 * `<input type="checkbox">`; we detect that and add a class so `markdown.css`
 * can lay them out without a bullet. Ordered/unordered lists get consistent
 * indentation and spacing.
 */

export function UnorderedList({
  className,
  children,
  node,
  ...props
}: WithNode<React.HTMLAttributes<HTMLUListElement>>) {
  void node
  return (
    <ul className={cn('md-ul', className)} {...props}>
      {children}
    </ul>
  )
}

export function OrderedList({
  className,
  children,
  node,
  ...props
}: WithNode<React.OlHTMLAttributes<HTMLOListElement>>) {
  void node
  return (
    <ol className={cn('md-ol', className)} {...props}>
      {children}
    </ol>
  )
}

export function ListItem({
  className,
  children,
  node,
  ...props
}: WithNode<React.LiHTMLAttributes<HTMLLIElement>>) {
  void node
  // remark-gfm marks task-list items with `className="task-list-item"`.
  const isTask =
    typeof className === 'string' && className.includes('task-list-item')
  return (
    <li className={cn('md-li', isTask && 'md-task-item', className)} {...props}>
      {children}
    </li>
  )
}
