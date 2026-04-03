import { useFileDiff } from '@/hooks/useFileDiff'
import { HunkBlock } from './HunkBlock'
import { ConflictResolutionPanel } from './ConflictResolutionPanel'
import type { FileStatus } from '@/lib/types'

function isConflicted(f: FileStatus): boolean {
  return f.staged === 'U' || f.unstaged === 'U' ||
    (f.staged === 'A' && f.unstaged === 'A') ||
    (f.staged === 'D' && f.unstaged === 'D')
}

interface ChunkDiffPanelProps {
  filePath: string
  staged: boolean
  fileStatus: FileStatus
}

export function ChunkDiffPanel({ filePath, staged, fileStatus }: ChunkDiffPanelProps) {
  if (isConflicted(fileStatus)) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          flexShrink: 0, padding: '8px 14px',
          borderBottom: '1px solid var(--border-sub)',
          background: 'var(--bg-panel)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <code style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-pri)' }}>
            {filePath}
          </code>
          <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600, padding: '1px 6px', background: 'color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: 3 }}>
            CONFLICT
          </span>
        </div>
        <ConflictResolutionPanel filePath={filePath} />
      </div>
    )
  }

  // Untracked file — git diff returns nothing; use --no-index instead
  const isUntracked = fileStatus.staged === '?' && fileStatus.unstaged === ''

  const { data: diffFile, isLoading } = useFileDiff(filePath, staged, isUntracked)

  if (isLoading || !diffFile) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-ter)', fontSize: 12 }}>
        Loading diff…
      </div>
    )
  }

  if (diffFile.binary) {
    return <EmptyPanel message="Binary file — diff not available" />
  }

  const hunks = diffFile.hunks ?? []

  const totalAdded = hunks.reduce((n, h) => n + (h.lines?.filter(l => l.type === 'add').length ?? 0), 0)
  const totalRemoved = hunks.reduce((n, h) => n + (h.lines?.filter(l => l.type === 'del').length ?? 0), 0)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* File header */}
      <div style={{
        flexShrink: 0, padding: '8px 14px',
        borderBottom: '1px solid var(--border-sub)',
        background: 'var(--bg-panel)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <code style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-pri)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filePath}
        </code>
        <div style={{ display: 'flex', gap: 8, fontSize: 11, flexShrink: 0, alignItems: 'center' }}>
          {staged && (
            <span style={{ fontSize: 10, color: 'var(--acc)', fontWeight: 600, padding: '1px 6px', background: 'var(--acc-soft)', borderRadius: 3 }}>
              STAGED
            </span>
          )}
          {totalAdded > 0 && (
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{totalAdded}</span>
          )}
          {totalRemoved > 0 && (
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>−{totalRemoved}</span>
          )}
        </div>
      </div>

      {/* Hunks */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-content)' }}>
        {hunks.map((hunk, idx) => (
          <HunkBlock key={idx} hunk={hunk} filePath={filePath} staged={staged} />
        ))}
        {hunks.length === 0 && (
          <EmptyPanel message="No changes to display" />
        )}
      </div>
    </div>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-ter)', fontSize: 12 }}>
      {message}
    </div>
  )
}
