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

import { useState, useRef, useCallback } from 'react'
import { Search } from 'lucide-react'
import { useGitStore } from '@/stores/gitStore'
import { CommitList } from '@/components/CommitGraph/CommitList'
import { CommitDetailPanel } from './CommitDetailPanel'

const STORAGE_KEY = 'history-split-left'
const DEFAULT_LEFT = 500
const MIN_LEFT = 220
const MIN_RIGHT = 280

function readSavedWidth(): number {
  const v = localStorage.getItem(STORAGE_KEY)
  return v ? parseInt(v, 10) : DEFAULT_LEFT
}

export default function HistoryView() {
  const { selectedCommit } = useGitStore()
  const [showAllBranches, setShowAllBranches] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [leftWidth, setLeftWidth] = useState(readSavedWidth)
  const leftWidthRef = useRef(leftWidth)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const onSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const onMouseMove = (ev: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const next = Math.max(MIN_LEFT, Math.min(ev.clientX - rect.left, rect.width - MIN_RIGHT))
      leftWidthRef.current = next
      setLeftWidth(next)
    }

    const onMouseUp = () => {
      setIsDragging(false)
      localStorage.setItem(STORAGE_KEY, String(leftWidthRef.current))
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-content)' }}>
      {/* Search / filter bar */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', borderBottom: '1px solid var(--border-sub)',
        background: 'var(--bg-toolbar)', flexShrink: 0,
      }}>
        <Search size={13} style={{ color: 'var(--text-ter)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search commits…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent', fontSize: 13, color: 'var(--text-pri)',
          }}
        />
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: 'var(--text-sec)', whiteSpace: 'nowrap', cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={showAllBranches}
            onChange={e => setShowAllBranches(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          All Branches
        </label>
      </div>

      {/* Commit list + splitter + detail panel */}
      <div
        ref={containerRef}
        style={{
          display: 'flex', flex: 1, overflow: 'hidden',
          cursor: isDragging ? 'col-resize' : 'default',
          userSelect: isDragging ? 'none' : 'auto',
        }}
      >
        <div style={{ width: selectedCommit ? leftWidth : undefined, flex: selectedCommit ? undefined : 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <CommitList all={showAllBranches} searchQuery={searchQuery} />
        </div>

        {selectedCommit && (
          <>
            {/* Splitter handle */}
            <div
              onMouseDown={onSplitterMouseDown}
              style={{
                width: 4, flexShrink: 0, cursor: 'col-resize',
                background: isDragging ? 'var(--acc)' : 'var(--border-sub)',
                transition: isDragging ? 'none' : 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = 'var(--acc)' }}
              onMouseLeave={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = 'var(--border-sub)' }}
            />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <CommitDetailPanel commitHash={selectedCommit} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
