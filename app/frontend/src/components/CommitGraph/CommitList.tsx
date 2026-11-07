import { Button } from '../shared/Button'
import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { useGitStore } from '@/stores/gitStore'
import { useCommits } from '@/hooks/useCommits'
import { useCherryPick } from '@/hooks/useCherryPick'
import { useRebase } from '@/hooks/useRebase'
import { useStatus } from '@/hooks/useStatus'
import { CommitRow } from './CommitRow'
import { GraphCanvas, ROW_HEIGHT } from './GraphCanvas'
import { KeyHints } from '@/components/shared/KeyHints'
import { RebaseSequenceEditor } from '@/components/HistoryView/RebaseSequenceEditor'
import type { CommitNode } from '@/lib/types'

const COL_WIDTH = 14
const OFFSET_X = 12
const MAX_AUTO_COLS = 3
const HEADER_HEIGHT = 26

interface ColState {
  graph: number | null  // null = auto-size
  author: number
  date: number
}

interface CommitListProps {
  limit?: number
  all?: boolean
  searchQuery?: string
}

export function CommitList({ limit = 500, all = true, searchQuery = '' }: CommitListProps) {
  const {
    selectedCommit, setSelectedCommit,
    selectedCommits, setSelectedCommits,
    setIsDraggingCommits,
  } = useGitStore()
  const outerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [cols, setCols] = useState<ColState>({ graph: null, author: 130, date: 90 })
  const [focused, setFocused] = useState(false)
  // anchor index for shift-click range selection
  const anchorIdx = useRef<number>(-1)

  const { data: allCommits = [] } = useCommits(limit, all)
  const { data: status } = useStatus()
  const { cherryPickMutation } = useCherryPick()
  const { startMutation: rebaseStartMutation } = useRebase()

  // Rebase editor state
  const [rebaseEditorCommits, setRebaseEditorCommits] = useState<CommitNode[] | null>(null)
  // Reword dialog state
  const [rewordCommit, setRewordCommit] = useState<CommitNode | null>(null)
  const [rewordMessage, setRewordMessage] = useState('')
  // Drop confirm state
  const [dropCommit, setDropCommit] = useState<CommitNode | null>(null)

  const currentBranch = status?.branch ?? ''

  // Client-side search filter
  const commits = useMemo(() => {
    if (!searchQuery.trim()) return allCommits
    const q = searchQuery.toLowerCase()
    return allCommits.filter(c =>
      c.message.toLowerCase().includes(q) ||
      c.hash.toLowerCase().includes(q) ||
      c.author.toLowerCase().includes(q)
    )
  }, [allCommits, searchQuery])

  const isSearching = !!searchQuery.trim()

  // Auto graph width based on deepest column used, capped at MAX_AUTO_COLS
  const autoGraphWidth = useMemo(() => {
    const maxCol = commits.reduce((m, c) => Math.max(m, c.column ?? 0), 0)
    return OFFSET_X + Math.min(maxCol + 1, MAX_AUTO_COLS) * COL_WIDTH + 8
  }, [commits])

  const graphWidth = cols.graph ?? autoGraphWidth

  // Track container dimensions via ResizeObserver
  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height: height - HEADER_HEIGHT })
    })
    observer.observe(el)
    setContainerSize({ width: el.clientWidth, height: el.clientHeight - HEADER_HEIGHT })
    return () => observer.disconnect()
  }, [])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top + e.currentTarget.scrollTop
    const idx = Math.floor(y / ROW_HEIGHT)
    setHoveredIdx(idx >= 0 && idx < commits.length ? idx : null)
  }, [commits.length])

  const handleMouseLeave = useCallback(() => setHoveredIdx(null), [])

  // Multi-select click handler
  const handleRowClick = useCallback((hash: string, event: React.MouseEvent) => {
    const idx = commits.findIndex(c => c.hash === hash)
    if (idx === -1) return

    if (event.shiftKey && anchorIdx.current >= 0) {
      // Range selection
      const lo = Math.min(anchorIdx.current, idx)
      const hi = Math.max(anchorIdx.current, idx)
      const range = commits.slice(lo, hi + 1).map(c => c.hash)
      setSelectedCommits(range)
      setSelectedCommit(hash)
    } else if (event.metaKey || event.ctrlKey) {
      // Toggle individual commit in selection
      const next = selectedCommits.includes(hash)
        ? selectedCommits.filter(h => h !== hash)
        : [...selectedCommits, hash]
      setSelectedCommits(next)
      setSelectedCommit(hash)
      anchorIdx.current = idx
    } else {
      // Single select — clear multi-selection
      setSelectedCommits([hash])
      setSelectedCommit(hash)
      anchorIdx.current = idx
    }
  }, [commits, selectedCommits, setSelectedCommit, setSelectedCommits])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIdx = commits.findIndex(c => c.hash === selectedCommit)
    let nextIdx = currentIdx

    if (e.key === 'ArrowDown' || (e.key === 'j' && !e.ctrlKey)) {
      nextIdx = Math.min(currentIdx + 1, commits.length - 1)
      e.preventDefault()
    } else if (e.key === 'ArrowUp' || (e.key === 'k' && !e.ctrlKey)) {
      nextIdx = Math.max(currentIdx - 1, 0)
      e.preventDefault()
    } else if (e.key === 'G') {
      nextIdx = commits.length - 1
      e.preventDefault()
    } else if ((e.key === 'l' || e.key === 'Tab') && !e.shiftKey) {
      e.preventDefault()
      if (e.key === 'l' && !e.ctrlKey) return // plain l — ignore
      const el = document.querySelector<HTMLElement>('[data-panel="history-detail"]')
      el?.focus()
      return
    } else if (e.key === 'Tab' && e.shiftKey) {
      return // no panel before commits
    } else if (e.key === 'd' && e.ctrlKey) {
      e.preventDefault()
      scrollRef.current?.scrollBy({ top: containerSize.height * 0.5 })
      return
    } else if (e.key === 'u' && e.ctrlKey) {
      e.preventDefault()
      scrollRef.current?.scrollBy({ top: -containerSize.height * 0.5 })
      return
    } else if (e.key === 'Escape') {
      setSelectedCommits([])
      return
    }

    if (nextIdx !== currentIdx && commits[nextIdx]) {
      setSelectedCommit(commits[nextIdx].hash)
      if (!e.shiftKey) {
        setSelectedCommits([commits[nextIdx].hash])
        anchorIdx.current = nextIdx
      } else if (anchorIdx.current >= 0) {
        const lo = Math.min(anchorIdx.current, nextIdx)
        const hi = Math.max(anchorIdx.current, nextIdx)
        setSelectedCommits(commits.slice(lo, hi + 1).map(c => c.hash))
      }
      const container = scrollRef.current
      if (container) {
        const targetTop = nextIdx * ROW_HEIGHT
        const targetBottom = targetTop + ROW_HEIGHT
        const h = containerSize.height
        if (targetTop < container.scrollTop) {
          container.scrollTop = targetTop
        } else if (targetBottom > container.scrollTop + h) {
          container.scrollTop = targetBottom - h
        }
      }
    }
  }, [commits, selectedCommit, setSelectedCommit, setSelectedCommits, containerSize.height])

  // Column drag-resize
  const startDrag = useCallback((col: 'graph' | 'author' | 'date', startX: number, startWidth: number) => {
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startX
      setCols(prev => ({ ...prev, [col]: Math.max(40, startWidth + delta) }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const handleCherryPick = useCallback((hashes: string[], combinedMessage: string) => {
    cherryPickMutation.mutate({ hashes, combinedMessage })
  }, [cherryPickMutation])

  // Open the full sequence editor for all commits from HEAD down to anchorHash.
  const handleOpenRebaseEditor = useCallback((anchorHash: string) => {
    const idx = commits.findIndex(c => c.hash === anchorHash)
    if (idx === -1) return
    setRebaseEditorCommits(commits.slice(0, idx + 1))
  }, [commits])

  // Quick reword: open dialog pre-filled with current message.
  const handleReword = useCallback((commit: CommitNode) => {
    setRewordCommit(commit)
    setRewordMessage(commit.message)
  }, [])

  // Squash into parent: run rebase with [pick parent, squash this].
  const handleSquash = useCallback((commit: CommitNode) => {
    const idx = commits.findIndex(c => c.hash === commit.hash)
    if (idx === -1 || idx === commits.length - 1) return // no parent in list
    const parent = commits[idx + 1] // next commit (older) is the parent in newest-first list
    rebaseStartMutation.mutate([
      { action: 'squash', hash: commit.hash, message: commit.message },
      { action: 'pick',   hash: parent.hash,  message: parent.message },
    ])
  }, [commits, rebaseStartMutation])

  // Drop commit: open confirmation dialog.
  const handleDrop = useCallback((commit: CommitNode) => {
    setDropCommit(commit)
  }, [])

  const confirmDrop = useCallback(() => {
    if (!dropCommit) return
    rebaseStartMutation.mutate([
      { action: 'drop', hash: dropCommit.hash, message: dropCommit.message },
    ])
    setDropCommit(null)
  }, [dropCommit, rebaseStartMutation])

  const handleDragStart = useCallback((_commit: CommitNode) => {
    setIsDraggingCommits(true)
  }, [setIsDraggingCommits])

  const handleDragEnd = useCallback(() => {
    setIsDraggingCommits(false)
  }, [setIsDraggingCommits])

  // Compute messages for currently selected commits (for multi-pick context menu)
  const selectedCommitMessages = useMemo(() => {
    return selectedCommits.map(h => {
      const c = commits.find(x => x.hash === h)
      return c?.fullMessage ?? ''
    })
  }, [selectedCommits, commits])

  // Virtualized window: only render visible rows ± 5 buffer
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5)
  const endIdx = Math.min(commits.length, Math.ceil((scrollTop + containerSize.height) / ROW_HEIGHT) + 5)

  return (
    <div ref={outerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Column header — graph column hidden during search */}
      <div style={{
        display: 'flex',
        height: HEADER_HEIGHT,
        borderBottom: '1px solid var(--border-sub)',
        background: 'var(--bg-toolbar)',
        flexShrink: 0,
        userSelect: 'none',
      }}>
        {!isSearching && (
          <div style={{ width: graphWidth, position: 'relative', flexShrink: 0 }}>
            <DragHandle onMouseDown={e => { e.preventDefault(); startDrag('graph', e.clientX, graphWidth) }} />
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 11, color: 'var(--text-ter)' }}>
          Summary
          {selectedCommits.length > 1 && (
            <span style={{
              marginLeft: 8,
              padding: '1px 6px',
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--acc) 20%, transparent)',
              color: 'var(--acc)',
              fontSize: 10,
              fontWeight: 600,
            }}>
              {selectedCommits.length} selected
            </span>
          )}
        </div>
        <div style={{ width: cols.author, position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 11, color: 'var(--text-ter)' }}>
          Author
          <DragHandle onMouseDown={e => { e.preventDefault(); startDrag('author', e.clientX, cols.author) }} />
        </div>
        <div style={{ width: cols.date, position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 11, color: 'var(--text-ter)' }}>
          Date
          <DragHandle onMouseDown={e => { e.preventDefault(); startDrag('date', e.clientX, cols.date) }} />
        </div>
      </div>

      {/* Canvas overlay + scrollable rows */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* Canvas is only shown when not searching — filtered commits don't have valid graph lines */}
        {!isSearching && (
          <GraphCanvas
            commits={commits}
            selectedHash={selectedCommit}
            hoveredIdx={hoveredIdx}
            scrollTop={scrollTop}
            containerHeight={containerSize.height}
            containerWidth={containerSize.width}
            graphWidth={graphWidth}
          />
        )}

        <div
          ref={scrollRef}
          data-panel="history-commits"
          style={{
            position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden',
            outline: 'none',
            boxShadow: focused ? 'inset 2px 0 0 var(--acc)' : 'none',
          }}
          onScroll={handleScroll}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          tabIndex={0}
          role="listbox"
          aria-label="Commit history"
          aria-multiselectable="true"
        >
          <div style={{ height: commits.length * ROW_HEIGHT, position: 'relative' }}>
            {commits.slice(startIdx, endIdx).map((commit, i) => (
              <CommitRow
                key={commit.hash}
                commit={commit}
                isSelected={commit.hash === selectedCommit}
                isMultiSelected={selectedCommits.includes(commit.hash)}
                graphWidth={isSearching ? 0 : graphWidth}
                authorWidth={cols.author}
                dateWidth={cols.date}
                style={{ position: 'absolute', top: (startIdx + i) * ROW_HEIGHT, left: 0, right: 0 }}
                onClick={handleRowClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onCherryPick={handleCherryPick}
                selectedCommits={selectedCommits}
                selectedCommitMessages={selectedCommitMessages}
                currentBranch={currentBranch}
                onOpenRebaseEditor={handleOpenRebaseEditor}
                onReword={handleReword}
                onSquash={handleSquash}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </div>

      </div>

      {focused && (
        <KeyHints hints={[
          { keys: ['↑', '↓'], label: 'Navigate' },
          { keys: ['Tab'], label: 'Detail' },
          { keys: ['⇧+Click'], label: 'Range' },
          { keys: ['⌘+Click'], label: 'Multi' },
        ]} />
      )}

      {/* Rebase sequence editor */}
      {rebaseEditorCommits && (
        <RebaseSequenceEditor
          commits={rebaseEditorCommits}
          onClose={() => setRebaseEditorCommits(null)}
        />
      )}

      {/* Reword dialog */}
      {rewordCommit && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
          }}
          onClick={() => setRewordCommit(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '20px 22px',
              width: 480,
              boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-pri)' }}>
              Reword Commit
            </div>
            <code style={{ fontSize: 11, color: 'var(--text-ter)', fontFamily: 'monospace' }}>
              {rewordCommit.shortHash}
            </code>
            <input
              autoFocus
              value={rewordMessage}
              onChange={e => setRewordMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); setRewordCommit(null) }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  if (rewordMessage.trim()) {
                    rebaseStartMutation.mutate(
                      [{ action: 'reword', hash: rewordCommit.hash, message: rewordMessage.trim() }],
                      { onSuccess: () => setRewordCommit(null) }
                    )
                  }
                }
              }}
              style={{
                border: '1px solid var(--border)', borderRadius: 6,
                background: 'var(--bg-input)', color: 'var(--text-pri)',
                fontSize: 12, fontFamily: 'monospace', padding: '7px 10px',
                outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--acc)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                onClick={() => setRewordCommit(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (rewordMessage.trim()) {
                    rebaseStartMutation.mutate(
                      [{ action: 'reword', hash: rewordCommit.hash, message: rewordMessage.trim() }],
                      { onSuccess: () => setRewordCommit(null) }
                    )
                  }
                }}
                disabled={!rewordMessage.trim() || rebaseStartMutation.isPending}
                variant="primary"
              >
                {rebaseStartMutation.isPending ? 'Rewording…' : 'Reword'}
              </Button>
            </div>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-ter)' }}>
              Press{' '}
              <kbd style={{ padding: '1px 4px', background: 'var(--bg-badge)', borderRadius: 3, fontFamily: 'monospace', fontSize: 10 }}>
                ⌘ Enter
              </kbd>
              {' '}to save
            </p>
          </div>
        </div>
      )}

      {/* Drop confirmation */}
      {dropCommit && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
          }}
          onClick={() => setDropCommit(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '20px 24px',
              width: 360,
              boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.preventDefault(); setDropCommit(null) }
              if (e.key === 'Enter') { e.preventDefault(); confirmDrop() }
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-pri)' }}>
              Drop Commit?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.5 }}>
              Commit{' '}
              <code style={{ fontFamily: 'monospace', color: 'var(--text-pri)' }}>
                {dropCommit.shortHash}
              </code>
              {' '}and all its changes will be permanently removed from history.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                autoFocus
                onClick={() => setDropCommit(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDrop}
                disabled={rebaseStartMutation.isPending}
                variant="danger"
              >
                {rebaseStartMutation.isPending ? 'Dropping…' : 'Drop Commit'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface DragHandleProps {
  onMouseDown: (e: React.MouseEvent) => void
}

function DragHandle({ onMouseDown }: DragHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
      }}
    >
      <div style={{ width: 1, height: 12, background: 'var(--border)' }} />
    </div>
  )
}
