import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StageHunk, UnstageHunk, DiscardHunk } from '@wailsjs/go/main/App'
import { useGitStore } from '@/stores/gitStore'
import { buildHunkPatch } from '@/lib/diffUtils'
import type { DiffHunk, DiffLine } from '@/lib/types'

interface HunkBlockProps {
  hunk: DiffHunk
  filePath: string
  staged: boolean
}

export function HunkBlock({ hunk, filePath, staged }: HunkBlockProps) {
  const queryClient = useQueryClient()
  const { showFlash } = useGitStore()
  const [expanded, setExpanded] = useState(true)
  const [headerHovered, setHeaderHovered] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['status'] })
    queryClient.invalidateQueries({ queryKey: ['diff'] })
  }

  const stageHunkMutation = useMutation({
    mutationFn: () => StageHunk(buildHunkPatch(filePath, hunk)),
    onSuccess: () => { invalidate(); showFlash('Hunk staged') },
    onError: (err: Error) => showFlash(`Stage failed: ${err.message}`, 'danger'),
  })

  const unstageHunkMutation = useMutation({
    mutationFn: () => UnstageHunk(buildHunkPatch(filePath, hunk)),
    onSuccess: () => { invalidate(); showFlash('Hunk unstaged') },
    onError: (err: Error) => showFlash(`Unstage failed: ${err.message}`, 'danger'),
  })

  const discardHunkMutation = useMutation({
    mutationFn: () => DiscardHunk(buildHunkPatch(filePath, hunk)),
    onSuccess: () => { invalidate(); showFlash('Changes discarded') },
    onError: (err: Error) => showFlash(`Discard failed: ${err.message}`, 'danger'),
  })

  const isPending = stageHunkMutation.isPending || unstageHunkMutation.isPending || discardHunkMutation.isPending

  return (
    <div style={{ borderLeft: '3px solid var(--bg-hunk)' }}>
      {/* Hunk header */}
      <div
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          padding: '4px 12px',
          background: headerHovered ? 'rgba(0,102,204,0.12)' : 'var(--bg-hunk)',
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-ter)', flexShrink: 0 }}>
          {expanded ? '▾' : '▸'}
        </span>
        <code style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-sec)' }}>
          {hunk.header}
        </code>

        {/* Action buttons — visible on header hover */}
        <div
          style={{ display: 'flex', gap: 4, opacity: headerHovered ? 1 : 0, transition: 'opacity 0.1s' }}
          onClick={e => e.stopPropagation()}
        >
          {!staged && (
            <HunkButton
              label="↑ Stage"
              color="var(--success)"
              hoverBg="var(--success-soft)"
              onClick={() => stageHunkMutation.mutate()}
              disabled={isPending}
            />
          )}
          {staged && (
            <HunkButton
              label="↓ Unstage"
              color="var(--acc)"
              hoverBg="var(--acc-soft)"
              onClick={() => unstageHunkMutation.mutate()}
              disabled={isPending}
            />
          )}
          {!staged && (
            <HunkButton
              label="✕ Discard"
              color="var(--danger)"
              hoverBg="var(--danger-soft)"
              onClick={() => discardHunkMutation.mutate()}
              disabled={isPending}
            />
          )}
        </div>
      </div>

      {/* Diff lines */}
      {expanded && (
        <div>
          {(hunk.lines ?? []).map((line, idx) => (
            <DiffLineRow key={idx} line={line} />
          ))}
        </div>
      )}
    </div>
  )
}

interface HunkButtonProps {
  label: string
  color: string
  hoverBg: string
  onClick: () => void
  disabled: boolean
}

function HunkButton({ label, color, hoverBg, onClick, disabled }: HunkButtonProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', borderRadius: 3,
        padding: '2px 7px', fontSize: 11, fontWeight: 600,
        color, background: hovered ? hoverBg : 'transparent',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.1s',
      }}
    >
      {label}
    </button>
  )
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const bg = line.type === 'add' ? 'var(--bg-add)' : line.type === 'del' ? 'var(--bg-del)' : 'var(--bg-content)'

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      fontFamily: 'monospace', fontSize: 12, lineHeight: '20px',
      background: bg,
    }}>
      {/* Old line number */}
      <span style={{
        width: 46, flexShrink: 0, textAlign: 'right', paddingRight: 8,
        color: 'var(--text-ter)', borderRight: '1px solid var(--border-sub)', userSelect: 'none',
      }}>
        {line.oldNo || ''}
      </span>

      {/* New line number */}
      <span style={{
        width: 46, flexShrink: 0, textAlign: 'right', paddingRight: 8,
        color: 'var(--text-ter)', borderRight: '1px solid var(--border-sub)', userSelect: 'none',
      }}>
        {line.newNo || ''}
      </span>

      {/* Content */}
      <span className="selectable" style={{ flex: 1, paddingLeft: 10, color: 'var(--text-pri)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {line.content}
      </span>
    </div>
  )
}
