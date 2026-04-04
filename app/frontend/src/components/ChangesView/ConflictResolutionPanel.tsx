import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GetFileContent, CheckoutOurs, CheckoutTheirs, AcceptBoth, StageFile, OpenMergeToolForFile } from '@wailsjs/go/main/App'
import { ChevronRight } from 'lucide-react'
import { useMergeCommits } from '@/hooks/useMergeCommits'
import { MergeCommitDetailDialog } from './MergeCommitDetailDialog'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'
import { formatRelativeDate } from '@/lib/format'
import type { CommitNode } from '@/lib/types'

interface Props {
  filePath: string
}

export function ConflictResolutionPanel({ filePath }: Props) {
  const queryClient = useQueryClient()
  const { showFlash } = useGitStore()
  const [commitsExpanded, setCommitsExpanded] = useState(true)
  const [detailCommit, setDetailCommit] = useState<CommitNode | null>(null)

  const { data: content, isLoading } = useQuery({
    queryKey: ['fileContent', filePath],
    queryFn: () => GetFileContent(filePath),
    staleTime: 0,
  })

  const { data: mergeCommits = [] } = useMergeCommits(true)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['status'] })
    queryClient.invalidateQueries({ queryKey: ['diff'] })
    queryClient.invalidateQueries({ queryKey: ['fileContent', filePath] })
  }

  const oursMutation = useMutation({
    mutationFn: () => CheckoutOurs(filePath),
    onSuccess: () => { invalidate(); showFlash('Accepted our version', 'success') },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  const theirsMutation = useMutation({
    mutationFn: () => CheckoutTheirs(filePath),
    onSuccess: () => { invalidate(); showFlash('Accepted their version', 'success') },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  const bothMutation = useMutation({
    mutationFn: () => AcceptBoth(filePath),
    onSuccess: () => { invalidate(); showFlash('Accepted both changes', 'success') },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  const markResolvedMutation = useMutation({
    mutationFn: () => StageFile(filePath),
    onSuccess: () => { invalidate(); showFlash('Marked as resolved', 'success') },
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  const openToolMutation = useMutation({
    mutationFn: () => OpenMergeToolForFile(filePath),
    onSuccess: () => showFlash('Merge tool launched — stage the file when done', 'info'),
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })

  const isPending = oursMutation.isPending || theirsMutation.isPending ||
    bothMutation.isPending || markResolvedMutation.isPending

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Action bar ── */}
      <div style={{
        flexShrink: 0,
        padding: '7px 14px',
        borderBottom: '1px solid var(--border-sub)',
        background: 'color-mix(in srgb, var(--danger) 8%, var(--bg-panel))',
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', marginRight: 4 }}>
          Conflict
        </span>
        <ActionButton label="Use Ours"    title="Accept the local (HEAD) version"       onClick={() => oursMutation.mutate()}        disabled={isPending} color="var(--acc)" />
        <ActionButton label="Use Theirs"  title="Accept the incoming branch version"    onClick={() => theirsMutation.mutate()}      disabled={isPending} color="var(--success)" />
        <ActionButton label="Use Both"    title="Keep both changes (remove markers)"    onClick={() => bothMutation.mutate()}        disabled={isPending} color="var(--warn)" />
        <div style={{ flex: 1 }} />
        <ActionButton label="External Tool" title="Open in git mergetool"               onClick={() => openToolMutation.mutate()}    disabled={openToolMutation.isPending} color="var(--text-sec)" subtle />
        <ActionButton label="Mark Resolved" title="Stage the file after manual editing" onClick={() => markResolvedMutation.mutate()} disabled={isPending} color="var(--text-pri)" subtle />
      </div>

      {/* ── Incoming commits ── */}
      {mergeCommits.length > 0 && (
        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border-sub)', background: 'var(--bg-panel)' }}>
          {/* Toggle row */}
          <button
            onClick={() => setCommitsExpanded(v => !v)}
            style={{
              width: '100%', padding: '5px 14px',
              border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'var(--text-sec)', fontSize: 11, fontWeight: 600,
            }}
          >
            <ChevronRight
              size={12}
              style={{ flexShrink: 0, color: 'var(--text-ter)', transform: commitsExpanded ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}
            />
            {mergeCommits.length} incoming commit{mergeCommits.length > 1 ? 's' : ''}
          </button>

          {/* Commit list */}
          {commitsExpanded && (
            <div style={{ maxHeight: 160, overflowY: 'auto', borderTop: '1px solid var(--border-sub)' }}>
              {mergeCommits.map(c => (
                <CommitRow key={c.hash} commit={c} onClick={() => setDetailCommit(c)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── File content ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-content)' }}>
        {isLoading ? (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--text-ter)' }}>Loading…</div>
        ) : (
          <ConflictContent content={content ?? ''} />
        )}
      </div>

      {/* ── Commit detail dialog ── */}
      {detailCommit && (
        <MergeCommitDetailDialog commit={detailCommit} onClose={() => setDetailCommit(null)} />
      )}
    </div>
  )
}

// ─── Incoming commit row ──────────────────────────────────────────────────────

function CommitRow({ commit, onClick }: { commit: CommitNode; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 14px',
        display: 'flex', alignItems: 'baseline', gap: 8,
        cursor: 'pointer',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        borderBottom: '1px solid var(--border-sub)',
      }}
    >
      <code style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--acc)', flexShrink: 0 }}>
        {commit.shortHash}
      </code>
      <span style={{ fontSize: 12, color: 'var(--text-pri)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {commit.message}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-ter)', flexShrink: 0 }}>
        {formatRelativeDate(commit.date)}
      </span>
    </div>
  )
}

// ─── Conflict content renderer ────────────────────────────────────────────────

function ConflictContent({ content }: { content: string }) {
  const lines = content.split('\n')

  type Region = 'normal' | 'ours' | 'theirs'
  let region: Region = 'normal'

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: '20px' }}>
      {lines.map((line, i) => {
        let bg = 'transparent'
        let color = 'var(--text-pri)'
        let fontWeight: React.CSSProperties['fontWeight'] = 400
        let borderColor = 'transparent'

        if (line.startsWith('<<<<<<<')) {
          region = 'ours'
          bg = 'color-mix(in srgb, var(--acc) 18%, transparent)'
          color = 'var(--acc)'
          fontWeight = 700
          borderColor = 'var(--acc)'
        } else if (region !== 'normal' && line.startsWith('=======')) {
          region = 'theirs'
          bg = 'color-mix(in srgb, var(--border) 40%, transparent)'
          color = 'var(--text-ter)'
          fontWeight = 700
          borderColor = 'var(--text-ter)'
        } else if (region === 'theirs' && line.startsWith('>>>>>>>')) {
          bg = 'color-mix(in srgb, var(--success) 18%, transparent)'
          color = 'var(--success)'
          fontWeight = 700
          borderColor = 'var(--success)'
          region = 'normal'
        } else {
          if (region === 'ours') { bg = 'color-mix(in srgb, var(--acc) 8%, transparent)'; borderColor = 'var(--acc)' }
          if (region === 'theirs') { bg = 'color-mix(in srgb, var(--success) 8%, transparent)'; borderColor = 'var(--success)' }
        }

        return (
          <div key={i} style={{ display: 'flex', background: bg, borderLeft: `3px solid ${borderColor}` }}>
            <span style={{
              flexShrink: 0, width: 44, textAlign: 'right',
              padding: '0 8px', fontSize: 11,
              color: 'var(--text-ter)', userSelect: 'none',
              borderRight: '1px solid var(--border-sub)',
            }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, padding: '0 12px', whiteSpace: 'pre', color, fontWeight, overflow: 'hidden' }}>
              {line || ' '}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Action button ────────────────────────────────────────────────────────────

interface ActionButtonProps {
  label: string
  title: string
  onClick: () => void
  disabled: boolean
  color: string
  subtle?: boolean
}

function ActionButton({ label, title, onClick, disabled, color, subtle }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '4px 10px', borderRadius: 5,
        border: subtle ? `1px solid var(--border)` : 'none',
        background: subtle ? 'transparent' : `color-mix(in srgb, ${color} 15%, transparent)`,
        color, fontSize: 11, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
