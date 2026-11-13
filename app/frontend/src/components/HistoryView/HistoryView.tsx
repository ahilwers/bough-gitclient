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

import { useState, useCallback } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGitStore } from '@/stores/gitStore'
import { useResizableWidth } from '@/hooks/useResizableWidth'
import { CommitList } from '@/components/CommitGraph/CommitList'
import { CommitDetailPanel } from './CommitDetailPanel'

/**
 * Persisted width of the commit list panel. The key predates the shared resize
 * hook; it is kept so an existing width survives the change.
 */
const COMMIT_LIST_WIDTH_KEY = 'history-split-left'
const MIN_COMMIT_LIST_WIDTH = 220
const MAX_COMMIT_LIST_WIDTH = 700
const DEFAULT_COMMIT_LIST_WIDTH = 500
/** Width step used when the splitter is operated with the keyboard. */
const KEYBOARD_RESIZE_STEP = 16

export default function HistoryView() {
  const { t } = useTranslation()
  const { selectedCommit } = useGitStore()
  const [showAllBranches, setShowAllBranches] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // The commit list panel width is user-adjustable and persists across sessions,
  // same as the file list panel in the changes view.
  const {
    width: commitListWidth,
    startResize: startCommitListResize,
    nudge: nudgeCommitListWidth,
    reset: resetCommitListWidth,
  } = useResizableWidth({
    storageKey: COMMIT_LIST_WIDTH_KEY,
    min: MIN_COMMIT_LIST_WIDTH,
    max: MAX_COMMIT_LIST_WIDTH,
    initial: DEFAULT_COMMIT_LIST_WIDTH,
  })
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false)

  const onSplitterMouseDown = useCallback((event: React.MouseEvent) => {
    setIsDraggingSplitter(true)
    startCommitListResize(event)
    const onUp = () => {
      setIsDraggingSplitter(false)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mouseup', onUp)
  }, [startCommitListResize])

  const onSplitterKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      nudgeCommitListWidth(-KEYBOARD_RESIZE_STEP)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      nudgeCommitListWidth(KEYBOARD_RESIZE_STEP)
    } else if (event.key === 'Home') {
      event.preventDefault()
      resetCommitListWidth()
    }
  }, [nudgeCommitListWidth, resetCommitListWidth])

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
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Commit list (left, user-adjustable width) */}
        <div
          data-panel="history-commitlist"
          style={{
            width: commitListWidth, flexShrink: 0,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          <CommitList all={showAllBranches} searchQuery={searchQuery} />
        </div>

        {/* Splitter handle for the commit list panel */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t('historyView.resizeCommitList', { defaultValue: 'Resize commit list' })}
          aria-valuenow={commitListWidth}
          aria-valuemin={MIN_COMMIT_LIST_WIDTH}
          aria-valuemax={MAX_COMMIT_LIST_WIDTH}
          tabIndex={0}
          onMouseDown={onSplitterMouseDown}
          onKeyDown={onSplitterKeyDown}
          onDoubleClick={resetCommitListWidth}
          style={{
            width: 4, flexShrink: 0, cursor: 'col-resize',
            background: isDraggingSplitter ? 'var(--acc)' : 'var(--border-sub)',
            transition: isDraggingSplitter ? 'none' : 'background 0.15s',
            outline: 'none',
          }}
          onMouseEnter={e => { if (!isDraggingSplitter) (e.currentTarget as HTMLDivElement).style.background = 'var(--acc)' }}
          onMouseLeave={e => { if (!isDraggingSplitter) (e.currentTarget as HTMLDivElement).style.background = 'var(--border-sub)' }}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedCommit ? (
            <CommitDetailPanel commitHash={selectedCommit} />
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'var(--text-ter)',
            }}>
              {t('commits.selectPrompt')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
