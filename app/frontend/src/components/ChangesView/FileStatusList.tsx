import { useState, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StageFile, StageFiles, UnstageFile, UnstageFiles, DiscardFile } from '@wailsjs/go/main/App'
import { useStatus } from '@/hooks/useStatus'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'
import { KeyHints } from '@/components/shared/KeyHints'
import type { FileStatus } from '@/lib/types'

function isConflicted(f: FileStatus): boolean {
  return f.staged === 'U' || f.unstaged === 'U' ||
    (f.staged === 'A' && f.unstaged === 'A') ||
    (f.staged === 'D' && f.unstaged === 'D')
}

// Helper: focus a named panel by data-panel attribute
function focusPanel(name: string) {
  const el = document.querySelector<HTMLElement>(`[data-panel="${name}"]`)
  el?.focus()
}

interface FileStatusListProps {
  selectedFile: string | null
  selectedStaged: boolean
  onSelectFile: (file: FileStatus, staged: boolean) => void
  /** Called when Tab is pressed to move focus to the diff panel */
  nextPanel?: string
}

export function FileStatusList({ selectedFile, selectedStaged, onSelectFile, nextPanel = 'changes-diff' }: FileStatusListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const queryClient = useQueryClient()
  const { showFlash } = useGitStore()
  const { data: status } = useStatus()

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['status'] })
    queryClient.invalidateQueries({ queryKey: ['diff'] })
  }, [queryClient])

  const stageFileMutation = useMutation({
    mutationFn: (path: string) => StageFile(path),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to stage: ${parseGitError(err)}`, 'danger'),
  })

  const stageAllMutation = useMutation({
    mutationFn: (paths: string[]) => StageFiles(paths),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to stage all: ${parseGitError(err)}`, 'danger'),
  })

  const unstageFileMutation = useMutation({
    mutationFn: (path: string) => UnstageFile(path),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to unstage: ${parseGitError(err)}`, 'danger'),
  })

  const unstageAllMutation = useMutation({
    mutationFn: (paths: string[]) => UnstageFiles(paths),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to unstage all: ${parseGitError(err)}`, 'danger'),
  })

  const discardFileMutation = useMutation({
    mutationFn: (path: string) => DiscardFile(path),
    onSuccess: invalidate,
    onError: (err: Error) => showFlash(`Failed to discard: ${parseGitError(err)}`, 'danger'),
  })

  const files = status?.files ?? []
  const conflictedFiles = files.filter(isConflicted)
  const unstagedFiles = files.filter(f => !isConflicted(f) && (f.unstaged !== '' || f.staged === '?'))
  const stagedFiles = files.filter(f => !isConflicted(f) && f.staged !== '' && f.staged !== '?')

  // Flat ordered list for keyboard navigation
  const allEntries: Array<{ file: FileStatus; staged: boolean }> = [
    ...conflictedFiles.map(f => ({ file: f, staged: false })),
    ...unstagedFiles.map(f => ({ file: f, staged: false })),
    ...stagedFiles.map(f => ({ file: f, staged: true })),
  ]

  const currentIdx = allEntries.findIndex(
    e => e.file.path === selectedFile && e.staged === selectedStaged
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Don't intercept when a button inside is focused
    if ((e.target as HTMLElement).tagName === 'BUTTON') return

    switch (e.key) {
      case 'ArrowDown':
      case 'j': {
        e.preventDefault()
        const next = allEntries[Math.min(currentIdx + 1, allEntries.length - 1)]
        if (next) onSelectFile(next.file, next.staged)
        break
      }
      case 'ArrowUp':
      case 'k': {
        e.preventDefault()
        const prev = allEntries[Math.max(currentIdx - 1, 0)]
        if (prev) onSelectFile(prev.file, prev.staged)
        break
      }
      case 's':
      case 'S': {
        e.preventDefault()
        const cur = allEntries[currentIdx]
        if (cur && !cur.staged && !isConflicted(cur.file)) {
          stageFileMutation.mutate(cur.file.path)
        }
        break
      }
      case 'u':
      case 'U': {
        e.preventDefault()
        const cur = allEntries[currentIdx]
        if (cur && cur.staged) unstageFileMutation.mutate(cur.file.path)
        break
      }
      case 'd':
      case 'D': {
        e.preventDefault()
        const cur = allEntries[currentIdx]
        if (cur && !cur.staged && cur.file.staged !== '?') {
          discardFileMutation.mutate(cur.file.path)
        }
        break
      }
      case '[': {
        e.preventDefault()
        // Jump to first unstaged file (or first conflicted if any)
        const firstUnstaged = allEntries.find(e => !e.staged)
        if (firstUnstaged) onSelectFile(firstUnstaged.file, false)
        break
      }
      case ']': {
        e.preventDefault()
        // Jump to first staged file
        const firstStaged = allEntries.find(e => e.staged)
        if (firstStaged) onSelectFile(firstStaged.file, true)
        break
      }
      case 'ArrowRight':
      case 'Enter':
      case 'Tab': {
        e.preventDefault()
        if (e.shiftKey) break // Shift+Tab handled below
        focusPanel(nextPanel)
        break
      }
    }
    // Shift+Tab — no previous panel, stay here
  }, [allEntries, currentIdx, onSelectFile, nextPanel, stageFileMutation, unstageFileMutation, discardFileMutation])

  return (
    <div
      ref={containerRef}
      data-panel="changes-filelist"
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={e => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setFocused(false)
      }}
      onKeyDown={handleKeyDown}
      style={{
        width: 240, flexShrink: 0,
        borderRight: '1px solid var(--border-sub)',
        background: 'var(--bg-sidebar)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        outline: 'none',
        boxShadow: focused ? 'inset 2px 0 0 var(--acc)' : 'none',
      }}
    >
      {/* Conflicts section */}
      {conflictedFiles.length > 0 && (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-sub)' }}>
          <SectionHeader
            title="Conflicts"
            count={conflictedFiles.length}
            accentBg="color-mix(in srgb, var(--danger) 10%, var(--bg-sidebar))"
          />
          <div>
            {conflictedFiles.map(file => (
              <FileRow
                key={file.path}
                file={file}
                statusCode="!"
                selected={file.path === selectedFile && !selectedStaged}
                onSelect={() => onSelectFile(file, false)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unstaged section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderBottom: '1px solid var(--border-sub)' }}>
        <SectionHeader
          title="Unstaged"
          count={unstagedFiles.length}
          actionLabel="Stage All"
          onAction={() => stageAllMutation.mutate(unstagedFiles.map(f => f.path))}
          accentBg="var(--bg-unstaged-sec)"
        />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {unstagedFiles.map(file => (
            <FileRow
              key={file.path}
              file={file}
              statusCode={file.unstaged || file.staged}
              selected={file.path === selectedFile && !selectedStaged}
              onSelect={() => onSelectFile(file, false)}
              actionIcon="+"
              actionTitle="Stage"
              onAction={() => stageFileMutation.mutate(file.path)}
            />
          ))}
          {unstagedFiles.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-ter)' }}>
              No unstaged changes
            </div>
          )}
        </div>
      </div>

      {/* Staged section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <SectionHeader
          title="Staged"
          count={stagedFiles.length}
          actionLabel="Unstage All"
          onAction={() => unstageAllMutation.mutate(stagedFiles.map(f => f.path))}
          accentBg="var(--bg-staged-sec)"
        />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {stagedFiles.map(file => (
            <FileRow
              key={file.path}
              file={file}
              statusCode={file.staged}
              selected={file.path === selectedFile && selectedStaged}
              onSelect={() => onSelectFile(file, true)}
              actionIcon="−"
              actionTitle="Unstage"
              onAction={() => unstageFileMutation.mutate(file.path)}
            />
          ))}
          {stagedFiles.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-ter)' }}>
              No staged changes
            </div>
          )}
        </div>
      </div>

      {/* Keyboard hints — visible when focused */}
      {focused && (
        <KeyHints hints={[
          { keys: ['↑', '↓'], label: 'Navigate' },
          { keys: ['[', ']'], label: 'Section' },
          { keys: ['Tab'], label: 'Diff' },
          { keys: ['S'], label: 'Stage' },
          { keys: ['U'], label: 'Unstage' },
          { keys: ['D'], label: 'Discard' },
        ]} />
      )}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string
  count: number
  actionLabel?: string
  onAction?: () => void
  accentBg: string
}

function SectionHeader({ title, count, actionLabel, onAction, accentBg }: SectionHeaderProps) {
  return (
    <div style={{
      flexShrink: 0, height: 28, padding: '0 10px',
      background: accentBg,
      borderBottom: '1px solid var(--border-sub)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-sec)' }}>
        {title}
        <span style={{ color: 'var(--text-ter)', marginLeft: 4 }}>({count})</span>
      </span>
      {count > 0 && actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 500, color: 'var(--acc)', padding: '1px 4px', borderRadius: 3,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// ─── File row ─────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: FileStatus
  statusCode: string
  selected: boolean
  onSelect: () => void
  actionIcon?: string
  actionTitle?: string
  onAction?: () => void
}

function FileRow({ file, statusCode, selected, onSelect, actionIcon, actionTitle, onAction }: FileRowProps) {
  const [hovered, setHovered] = useState(false)

  const isConflict = statusCode === '!'
  const label = isConflict ? '!' : statusCode === 'A' ? 'A' : statusCode === 'D' ? 'D' : statusCode === '?' ? '?' : 'M'
  const badgeColor = isConflict ? 'var(--danger)' : label === 'A' ? 'var(--success)' : label === 'D' ? 'var(--danger)' : 'var(--warn)'

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 10px',
        display: 'flex', alignItems: 'center', gap: 7,
        cursor: 'pointer',
        borderBottom: '1px solid var(--border-sub)',
        background: selected ? 'var(--bg-sel)' : hovered ? 'var(--bg-hover)' : 'transparent',
        userSelect: 'none',
      }}
    >
      <span style={{
        width: 17, height: 17, borderRadius: 3, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: badgeColor, color: 'white', fontSize: 10, fontWeight: 700,
      }}>
        {label}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontFamily: 'monospace', color: 'var(--text-pri)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {file.path}
        </div>
        {file.oldPath && file.oldPath !== file.path && (
          <div style={{ fontSize: 10, color: 'var(--text-ter)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ← {file.oldPath}
          </div>
        )}
      </div>

      {onAction && (
        <button
          onClick={e => { e.stopPropagation(); onAction() }}
          title={actionTitle}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            width: 20, height: 20, borderRadius: 3, flexShrink: 0,
            fontSize: 13, fontWeight: 700, lineHeight: 1, color: 'var(--text-sec)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: hovered ? 1 : 0, transition: 'opacity 0.1s',
          }}
        >
          {actionIcon}
        </button>
      )}
    </div>
  )
}
