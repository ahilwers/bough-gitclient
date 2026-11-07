// Copyright (C) 2026 Achim Hilwers
//
// This file is part of Bough.
//
// Bough is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { useRef, useEffect, useState } from 'react'
import type { CommitNode } from '@/lib/types'
import { getGraphColors } from '@/lib/colors'

export const ROW_HEIGHT = 34
const COL_WIDTH = 14
const OFFSET_X = 12
const DOT_RADIUS = 4
const MERGE_DOT_RADIUS = 5.5

interface GraphCanvasProps {
  commits: CommitNode[]
  selectedHash: string | null | undefined
  hoveredIdx: number | null
  scrollTop: number
  /** Height of the visible scroll area (not full content height) */
  containerHeight: number
  /** Full width of the container — used for row highlight backgrounds */
  containerWidth: number
  /** Width of the graph column — canvas clips lines/dots to this boundary */
  graphWidth: number
}

/** Viewport-sized canvas: redraws on each scroll tick, no translateY needed. */
export function GraphCanvas({
  commits,
  selectedHash,
  hoveredIdx,
  scrollTop,
  containerHeight,
  containerWidth,
  graphWidth,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dpr] = useState(() => window.devicePixelRatio || 1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || containerWidth <= 0 || containerHeight <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = containerWidth
    const h = containerHeight

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const cssVars = getComputedStyle(document.documentElement)
    const selColor   = cssVars.getPropertyValue('--bg-sel-row').trim()   || 'rgba(0,102,204,0.07)'
    const hoverColor = cssVars.getPropertyValue('--bg-hover').trim()     || 'rgba(0,0,0,0.04)'
    const borderColor = cssVars.getPropertyValue('--border').trim()      || 'rgba(0,0,0,0.13)'
    const colors = getGraphColors()

    // Row y in canvas coords: absolute_row_y - scrollTop
    const rowY = (i: number) => i * ROW_HEIGHT - scrollTop

    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2)
    const endIdx   = Math.min(commits.length, Math.ceil((scrollTop + h) / ROW_HEIGHT) + 2)

    // 1. Row highlight backgrounds (full width)
    for (let i = startIdx; i < endIdx; i++) {
      const y = rowY(i)
      const commit = commits[i]
      if (commit.hash === selectedHash) {
        ctx.fillStyle = selColor
        ctx.fillRect(0, y, w, ROW_HEIGHT)
      } else if (i === hoveredIdx) {
        ctx.fillStyle = hoverColor
        ctx.fillRect(0, y, w, ROW_HEIGHT)
      }
    }

    // 2. Graph lines and dots — clipped to graphWidth so they never bleed into text
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, graphWidth, h)
    ctx.clip()

    ctx.lineWidth = 1.5
    for (let i = startIdx; i < endIdx; i++) {
      const commit = commits[i]
      if (!commit.lines?.length) continue

      const fromY = rowY(i) + ROW_HEIGHT / 2
      const toY   = rowY(i + 1) + ROW_HEIGHT / 2

      for (const line of commit.lines) {
        const fromX = OFFSET_X + line.fromCol * COL_WIDTH
        const toX   = OFFSET_X + line.toCol   * COL_WIDTH
        ctx.strokeStyle = colors[line.color % colors.length]
        ctx.beginPath()
        if (fromX !== toX) {
          // Smooth arc: control points at 40% and 60% of the vertical span so
          // the curve starts bending toward the destination column immediately
          // rather than going straight down before turning.
          const dy = toY - fromY
          ctx.moveTo(fromX, fromY)
          ctx.bezierCurveTo(fromX, fromY + dy * 0.4, toX, toY - dy * 0.4, toX, toY)
        } else {
          ctx.moveTo(fromX, fromY)
          ctx.lineTo(toX, toY)
        }
        ctx.stroke()
      }
    }

    // 3. Commit dots
    for (let i = startIdx; i < endIdx; i++) {
      const commit = commits[i]
      const x = OFFSET_X + commit.column * COL_WIDTH
      const y = rowY(i) + ROW_HEIGHT / 2
      const isSelected = commit.hash === selectedHash
      const color = colors[commit.color % colors.length]
      const isMerge = (commit.parents?.length ?? 0) > 1

      // Outer ring
      ctx.strokeStyle = isSelected ? color : borderColor
      ctx.lineWidth = isSelected ? 2 : 1.5
      ctx.beginPath()
      ctx.arc(x, y, isMerge ? MERGE_DOT_RADIUS : DOT_RADIUS + 1, 0, Math.PI * 2)
      ctx.stroke()

      // Filled center
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }, [commits, selectedHash, hoveredIdx, scrollTop, containerHeight, containerWidth, graphWidth, dpr])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    />
  )
}
