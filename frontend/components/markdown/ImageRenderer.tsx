'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { useMarkdownContext, type WithNode } from '@/lib/markdown/utils'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

/**
 * Image renderer: responsive, rounded, lazy-loaded, with optional click-to-zoom.
 *
 * We intentionally use a plain `<img>` (not next/image) because Markdown image
 * sources are arbitrary/remote and unknown at build time — next/image would
 * require host allow-listing per source. `loading="lazy"` + `decoding="async"`
 * give the perf win without that constraint.
 */
export function ImageRenderer({
  src,
  alt,
  className,
  node,
  ...props
}: WithNode<React.ImgHTMLAttributes<HTMLImageElement>>) {
  void node
  const { features } = useMarkdownContext()

  if (!features.images || !src) return null

  const img = (
    <img
      src={src}
      alt={alt ?? ''}
      className={cn('md-image', className)}
      loading={features.lazyImages ? 'lazy' : undefined}
      decoding={features.lazyImages ? 'async' : undefined}
      {...props}
    />
  )

  if (!features.imageZoom) return img

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="md-image-zoom-trigger"
          aria-label={alt ? `Zoom image: ${alt}` : 'Zoom image'}
        >
          {img}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="sr-only">{alt || 'Image preview'}</DialogTitle>
        <img
          src={src}
          alt={alt ?? ''}
          className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
