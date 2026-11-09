// Copyright (C) 2026 Achim Hilwers
//
// This file is part of GitMorrow.
//
// GitMorrow is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef, useState } from 'react'
import { formatBytes } from '@/lib/images'

/**
 * One side of the image diff — a base64 data URL plus its original byte size.
 * A side with an empty `dataURL` means "no image on this side" (e.g. the file
 * was added or removed in this commit).
 */
export interface ImageSide {
  dataURL: string
  size: number
}

interface ImageDiffViewProps {
  left: ImageSide | null | undefined
  right: ImageSide | null | undefined
  leftLabel: string
  rightLabel: string
  leftEmptyHint?: string
  rightEmptyHint?: string
  /** Set while the image queries are still in flight. */
  loading?: boolean
}

// Fixed vertical chrome per panel: label row + metadata row.
const PANEL_CHROME = 26 + 24
const PANEL_GAP = 1 // 1px divider between panels

/**
 * Side-by-side image diff. Both images are rendered at the SAME scale factor so
 * real size differences remain visible, and the common scale is chosen so both
 * fit into the available space (never upscaled). When one side is missing the
 * other side uses the full width.
 */
export function ImageDiffView({
  left, right, leftLabel, rightLabel,
  leftEmptyHint = 'No image',
  rightEmptyHint = 'No image',
  loading,
}: ImageDiffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setAvail({
        w: rect.width,
        h: Math.max(0, rect.height - PANEL_CHROME),
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const leftSize = useMeasuredSize(left?.dataURL)
  const rightSize = useMeasuredSize(right?.dataURL)

  const hasLeft = !!left?.dataURL
  const hasRight = !!right?.dataURL
  const bothPresent = hasLeft && hasRight

  // Width available to each image pane.
  const paneWidth = bothPresent
    ? Math.max(0, (avail.w - PANEL_GAP) / 2)
    : avail.w

  // Common scale so both fit; images are never upscaled.
  const candidates: number[] = []
  if (hasLeft && leftSize.dims) candidates.push(scaleToFit(leftSize.dims, paneWidth, avail.h))
  if (hasRight && rightSize.dims) candidates.push(scaleToFit(rightSize.dims, paneWidth, avail.h))
  const scale = candidates.length > 0 ? Math.min(1, ...candidates) : 1

  const isLoading = loading && !hasLeft && !hasRight

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Pane
          label={leftLabel}
          src={hasLeft ? left!.dataURL : null}
          size={hasLeft ? left!.size : 0}
          dims={leftSize.dims}
          onLoad={leftSize.onLoad}
          width={hasLeft && leftSize.dims ? leftSize.dims.w * scale : undefined}
          height={hasLeft && leftSize.dims ? leftSize.dims.h * scale : undefined}
          emptyHint={leftEmptyHint}
          accent="var(--danger)"
        />
        {bothPresent && (
          <div style={{ width: PANEL_GAP, flexShrink: 0, background: 'var(--border-sub)' }} />
        )}
        <Pane
          label={rightLabel}
          src={hasRight ? right!.dataURL : null}
          size={hasRight ? right!.size : 0}
          dims={rightSize.dims}
          onLoad={rightSize.onLoad}
          width={hasRight && rightSize.dims ? rightSize.dims.w * scale : undefined}
          height={hasRight && rightSize.dims ? rightSize.dims.h * scale : undefined}
          emptyHint={rightEmptyHint}
          accent="var(--success)"
        />
      </div>

      {isLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-ter)', pointerEvents: 'none' }}>
          Loading images…
        </div>
      )}
    </div>
  )
}

function scaleToFit(dims: { w: number; h: number }, availW: number, availH: number): number {
  const sx = availW > 0 ? availW / dims.w : Infinity
  const sy = availH > 0 ? availH / dims.h : Infinity
  return Math.min(sx, sy)
}

function useMeasuredSize(dataURL: string | undefined) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [seenURL, setSeenURL] = useState<string | undefined>(undefined)

  // Reset the previous dimensions *during render*, before the browser commits
  // the new src. A passive-effect reset races the browser's image load: when a
  // commit is switched while the diff is already on screen, the <img> keeps its
  // DOM identity and the new (possibly cached) image can fire `load` before
  // React runs the reset effect. The onLoad handler would then still be
  // detached and the new image would stay hidden forever. Resetting here
  // guarantees the handler is attached by the time the new src is committed.
  if (seenURL !== dataURL) {
    setSeenURL(dataURL)
    setDims(null)
  }

  return {
    dims,
    onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setDims({ w: img.naturalWidth, h: img.naturalHeight })
      }
    },
  }
}

interface PaneProps {
  label: string
  src: string | null
  size: number
  dims: { w: number; h: number } | null
  onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
  width?: number
  height?: number
  emptyHint: string
  accent: string
}

function Pane({ label, src, size, dims, onLoad, width, height, emptyHint, accent }: PaneProps) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Label */}
      <div style={{
        flexShrink: 0, height: 26, display: 'flex', alignItems: 'center',
        padding: '0 10px', gap: 8,
        color: 'var(--text-sec)', fontSize: 11, fontWeight: 600,
        borderBottom: '1px solid var(--border-sub)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: accent, flexShrink: 0 }} />
        {label}
      </div>

      {/* Image area */}
      <div style={{
        flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'color-mix(in srgb, var(--text-pri) 4%, transparent)',
      }}>
        {src == null ? (
          <div style={{ fontSize: 12, color: 'var(--text-ter)' }}>{emptyHint}</div>
        ) : (
          <img
            src={src}
            alt={label}
            draggable={false}
            onLoad={onLoad}
            style={{
              // Hidden until natural dimensions are known, then placed at the
              // computed common scale (width+height keep relative sizes true).
              visibility: dims ? 'visible' : 'hidden',
              width: width !== undefined ? width : 'auto',
              height: height !== undefined ? height : 'auto',
              objectFit: 'contain',
              borderRadius: 2,
              boxShadow: '0 1px 6px rgba(0,0,0,0.18)',
              background: 'var(--bg-content)',
            }}
          />
        )}
      </div>

      {/* Metadata */}
      <div style={{
        flexShrink: 0, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, fontSize: 10, color: 'var(--text-ter)',
        borderTop: '1px solid var(--border-sub)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {src == null ? (
          <span>—</span>
        ) : (
          <>
            {dims ? <span>{dims.w} × {dims.h} px</span> : <span>…</span>}
            {size > 0 && <span>{formatBytes(size)}</span>}
          </>
        )}
      </div>
    </div>
  )
}
