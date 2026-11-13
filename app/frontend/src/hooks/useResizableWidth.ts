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

import { useCallback, useEffect, useRef, useState } from 'react'

export interface ResizableWidthOptions {
  /** localStorage key the width is persisted under. */
  storageKey: string
  /** Smallest width the panel may be shrunk to (px). */
  min: number
  /** Largest width the panel may be grown to (px). */
  max: number
  /** Width used when nothing was persisted yet (px). */
  initial: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function readStoredWidth(storageKey: string, min: number, max: number, initial: number): number {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = Number.parseInt(stored, 10)
      if (Number.isFinite(parsed)) return clamp(parsed, min, max)
    }
  } catch {
    // localStorage is unavailable in some test environments.
  }
  return initial
}

/**
 * useResizableWidth keeps a panel width between min and max, supports pointer
 * dragging and keyboard resizing, and persists the result across sessions.
 */
export function useResizableWidth({ storageKey, min, max, initial }: ResizableWidthOptions) {
  const [width, setWidth] = useState<number>(() => readStoredWidth(storageKey, min, max, initial))
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const persist = useCallback((value: number) => {
    try {
      localStorage.setItem(storageKey, String(value))
    } catch {
      // localStorage is unavailable in some test environments.
    }
  }, [storageKey])

  const startResize = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    dragRef.current = { startX: event.clientX, startWidth: width }
    const onMove = (move: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      setWidth(clamp(drag.startWidth + (move.clientX - drag.startX), min, max))
    }
    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setWidth(current => { persist(current); return current })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [min, max, persist, width])

  /** Adjusts the width by a fixed step, used by the keyboard handler. */
  const nudge = useCallback((delta: number) => {
    setWidth(current => {
      const next = clamp(current + delta, min, max)
      persist(next)
      return next
    })
  }, [min, max, persist])

  const reset = useCallback(() => {
    setWidth(current => { persist(initial); return initial })
  }, [initial, persist])

  return { width, setWidth, startResize, nudge, reset }
}
