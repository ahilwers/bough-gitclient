import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { useGitStore } from '@/stores/gitStore'
import { useCommits } from '@/hooks/useCommits'
import { CommitRow } from './CommitRow'
import { GraphCanvas, ROW_HEIGHT } from './GraphCanvas'

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
  const { selectedCommit, setSelectedCommit } = useGitStore()
  const outerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [cols, setCols] = useState<ColState>({ graph: null, author: 130, date: 90 })

  const { data: allCommits = [] } = useCommits(limit, all)

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIdx = commits.findIndex(c => c.hash === selectedCommit)
    let nextIdx = currentIdx

    if (e.key === 'ArrowDown' || e.key === 'j') {
      nextIdx = Math.min(currentIdx + 1, commits.length - 1)
      e.preventDefault()
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      nextIdx = Math.max(currentIdx - 1, 0)
      e.preventDefault()
    }

    if (nextIdx !== currentIdx && commits[nextIdx]) {
      setSelectedCommit(commits[nextIdx].hash)
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
  }, [commits, selectedCommit, setSelectedCommit, containerSize.height])

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
          style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden' }}
          onScroll={handleScroll}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="listbox"
          aria-label="Commit history"
          className="focus:outline-none"
        >
          <div style={{ height: commits.length * ROW_HEIGHT, position: 'relative' }}>
            {commits.slice(startIdx, endIdx).map((commit, i) => (
              <CommitRow
                key={commit.hash}
                commit={commit}
                isSelected={commit.hash === selectedCommit}
                graphWidth={isSearching ? 0 : graphWidth}
                authorWidth={cols.author}
                dateWidth={cols.date}
                style={{ position: 'absolute', top: (startIdx + i) * ROW_HEIGHT, left: 0, right: 0 }}
                onClick={setSelectedCommit}
              />
            ))}
          </div>
        </div>
      </div>
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
