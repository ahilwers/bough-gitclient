import { Button } from '../shared/Button'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { ApplyStash, PopStash, DropStash, ApplyStashHunk, ApplyStashFile } from '@wailsjs/go/main/App'
import { useStashDiff } from '@/hooks/useStashDiff'
import { useGitStore } from '@/stores/gitStore'
import { HunkBlock } from '@/components/ChangesView/HunkBlock'
import type { HunkAction } from '@/components/ChangesView/HunkBlock'
import { buildHunkPatch } from '@/lib/diffUtils'
import { parseGitError, formatRelativeDate } from '@/lib/format'
import { isImagePath } from '@/lib/images'
import { StashImageDiff } from './StashImageDiff'
import type { StashEntry, DiffFile, DiffHunk } from '@/lib/types'

interface StashDiffViewProps {
  entry: StashEntry
  onClose: () => void
}

export function StashDiffView({ entry, onClose }: StashDiffViewProps) {
  const queryClient = useQueryClient()
  const { showFlash } = useGitStore()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const { data: files, isLoading } = useStashDiff(entry.index)

  // Auto-select first file when diff loads
  const displayFiles = files ?? []
  const activeFile = selectedFile ?? displayFiles[0]?.path ?? null
  const activeDiffFile = displayFiles.find(f => f.path === activeFile)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stashes'] })
    queryClient.invalidateQueries({ queryKey: ['status'] })
    queryClient.invalidateQueries({ queryKey: ['stashDiff', entry.index] })
  }

  const applyAllMutation = useMutation({
    mutationFn: () => ApplyStash(entry.index),
    onSuccess: () => { invalidate(); showFlash('Stash applied', 'success') },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  const popMutation = useMutation({
    mutationFn: () => PopStash(entry.index),
    onSuccess: () => { invalidate(); onClose(); showFlash('Stash popped', 'success') },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  const dropMutation = useMutation({
    mutationFn: () => DropStash(entry.index),
    onSuccess: () => { invalidate(); onClose(); showFlash('Stash dropped', 'success') },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  const applyFileMutation = useMutation({
    mutationFn: (filePath: string) => ApplyStashFile(entry.index, filePath),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['status'] }); showFlash('File applied from stash', 'success') },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  const applyHunkMutation = useMutation({
    mutationFn: (patch: string) => ApplyStashHunk(patch),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['status'] }); showFlash('Hunk applied from stash', 'success') },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  const anyPending = applyAllMutation.isPending || popMutation.isPending || dropMutation.isPending

  const hunkActionsFor = (diffFile: DiffFile, hunk: DiffHunk): HunkAction[] => [
    {
      label: '↓ Apply hunk',
      color: 'var(--acc)',
      hoverBg: 'var(--acc-soft)',
      onClick: () => applyHunkMutation.mutate(buildHunkPatch(diffFile.path, hunk)),
      isPending: applyHunkMutation.isPending,
    },
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-content)',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
      }}>
        <Button variant="icon" aria-label="Close"
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-sec)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 4,
          }}
        >
          <X size={16} />
        </Button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-pri)' }}>
            {entry.message}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-ter)', marginLeft: 10 }}>
            stash@{'{' + entry.index + '}'}  ·  {formatRelativeDate(entry.date)}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <ActionButton
            label="Apply all"
            onClick={() => applyAllMutation.mutate()}
            disabled={anyPending}
          />
          <ActionButton
            label="Pop"
            onClick={() => popMutation.mutate()}
            disabled={anyPending}
          />
          <ActionButton
            label="Drop"
            onClick={() => dropMutation.mutate()}
            disabled={anyPending}
            danger
          />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File list */}
        <div style={{
          width: 240,
          flexShrink: 0,
          borderRight: '1px solid var(--border-sub)',
          background: 'var(--bg-sidebar)',
          overflowY: 'auto',
        }}>
          <div style={{
            height: 28, padding: '0 10px',
            display: 'flex', alignItems: 'center',
            borderBottom: '1px solid var(--border-sub)',
            fontSize: 11, fontWeight: 600, color: 'var(--text-sec)',
          }}>
            Changed files ({displayFiles.length})
          </div>

          {isLoading && (
            <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-ter)' }}>Loading…</div>
          )}

          {displayFiles.map(f => (
            <StashFileRow
              key={f.path}
              file={f}
              selected={f.path === activeFile}
              onSelect={() => setSelectedFile(f.path)}
              onApply={() => applyFileMutation.mutate(f.path)}
            />
          ))}
        </div>

        {/* Diff panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeDiffFile && !isLoading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-ter)', fontSize: 12 }}>
              Select a file to view its diff
            </div>
          )}

          {activeDiffFile && (
            <>
              {/* File header */}
              <div style={{
                flexShrink: 0, padding: '8px 14px',
                borderBottom: '1px solid var(--border-sub)',
                background: 'var(--bg-panel)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <code style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-pri)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeDiffFile.path}
                </code>
                <Button variant="primary"
                  onClick={() => applyFileMutation.mutate(activeDiffFile.path)}
                  disabled={applyFileMutation.isPending}
                  style={{ flexShrink: 0 }}
                >
                  Apply file
                </Button>
              </div>

              {/* Hunks */}
              <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-content)' }}>
                {activeDiffFile.binary && isImagePath(activeDiffFile.path) ? (
                  <StashImageDiff index={entry.index} filePath={activeDiffFile.path} />
                ) : activeDiffFile.binary ? (
                  <div style={{ padding: 20, fontSize: 12, color: 'var(--text-ter)' }}>Binary file</div>
                ) : (activeDiffFile.hunks ?? []).length === 0 ? (
                  <div style={{ padding: 20, fontSize: 12, color: 'var(--text-ter)' }}>No changes</div>
                ) : (
                  (activeDiffFile.hunks ?? []).map((hunk, idx) => (
                    <HunkBlock
                      key={idx}
                      hunk={hunk}
                      filePath={activeDiffFile.path}
                      staged={false}
                      actions={hunkActionsFor(activeDiffFile, hunk)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface StashFileRowProps {
  file: DiffFile
  selected: boolean
  onSelect: () => void
  onApply: () => void
}

function StashFileRow({ file, selected, onSelect, onApply }: StashFileRowProps) {
  const [hovered, setHovered] = useState(false)
  const added = (file.hunks ?? []).reduce((n, h) => n + (h.lines ?? []).filter(l => l.type === 'add').length, 0)
  const deleted = (file.hunks ?? []).reduce((n, h) => n + (h.lines ?? []).filter(l => l.type === 'del').length, 0)

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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-pri)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.path}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-ter)', display: 'flex', gap: 6 }}>
          {added > 0 && <span style={{ color: 'var(--success)' }}>+{added}</span>}
          {deleted > 0 && <span style={{ color: 'var(--danger)' }}>−{deleted}</span>}
        </div>
      </div>
      <Button variant="ghost"
        onClick={e => { e.stopPropagation(); onApply() }}
        title="Apply this file"
        aria-label="Apply this file"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 600, color: 'var(--acc)',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.1s',
          padding: '1px 5px', borderRadius: 3,
        }}
      >
        Apply
      </Button>
    </div>
  )
}

function ActionButton({ label, onClick, disabled, danger }: { label: string; onClick: () => void; disabled: boolean; danger?: boolean }) {
  return <Button variant={danger ? 'danger' : 'secondary'} onClick={onClick} disabled={disabled}>{label}</Button>
}
