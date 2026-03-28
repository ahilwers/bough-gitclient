import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StageFile, StageFiles, UnstageFile, UnstageFiles } from '@wailsjs/go/main/App'
import { useStatus } from '@/hooks/useStatus'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'
import type { FileStatus } from '@/lib/types'

interface FileStatusListProps {
  selectedFile: string | null
  selectedStaged: boolean
  onSelectFile: (file: FileStatus, staged: boolean) => void
}

export function FileStatusList({ selectedFile, selectedStaged, onSelectFile }: FileStatusListProps) {
  const queryClient = useQueryClient()
  const { showFlash } = useGitStore()
  const { data: status } = useStatus()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['status'] })
    queryClient.invalidateQueries({ queryKey: ['diff'] })
  }

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

  const files = status?.files ?? []
  // untracked: staged === "?", unstaged === "" (after repository.go normalisation)
  const unstagedFiles = files.filter(f => f.unstaged !== '' || f.staged === '?')
  const stagedFiles = files.filter(f => f.staged !== '' && f.staged !== '?')

  return (
    <div style={{
      width: 240, flexShrink: 0,
      borderRight: '1px solid var(--border-sub)',
      background: 'var(--bg-sidebar)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
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
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  count: number
  actionLabel: string
  onAction: () => void
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
      {count > 0 && (
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

interface FileRowProps {
  file: FileStatus
  statusCode: string
  selected: boolean
  onSelect: () => void
  actionIcon: string
  actionTitle: string
  onAction: () => void
}

function FileRow({ file, statusCode, selected, onSelect, actionIcon, actionTitle, onAction }: FileRowProps) {
  const [hovered, setHovered] = useState(false)

  const label = statusCode === 'A' ? 'A' : statusCode === 'D' ? 'D' : statusCode === '?' ? '?' : 'M'
  const badgeColor = label === 'A' ? 'var(--success)' : label === 'D' ? 'var(--danger)' : 'var(--warn)'

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
      {/* Status badge */}
      <span style={{
        width: 17, height: 17, borderRadius: 3, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: badgeColor, color: 'white', fontSize: 10, fontWeight: 700,
      }}>
        {label}
      </span>

      {/* Filename */}
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

      {/* Stage/unstage button — visible on hover */}
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
    </div>
  )
}
