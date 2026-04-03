import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GetFileContent, CheckoutOurs, CheckoutTheirs, StageFile, OpenMergeToolForFile } from '@wailsjs/go/main/App'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'

interface Props {
  filePath: string
}

export function ConflictResolutionPanel({ filePath }: Props) {
  const queryClient = useQueryClient()
  const { showFlash } = useGitStore()

  const { data: content, isLoading } = useQuery({
    queryKey: ['fileContent', filePath],
    queryFn: () => GetFileContent(filePath),
    staleTime: 0,
  })

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

  const isPending = oursMutation.isPending || theirsMutation.isPending || markResolvedMutation.isPending

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Action bar */}
      <div style={{
        flexShrink: 0,
        padding: '8px 14px',
        borderBottom: '1px solid var(--border-sub)',
        background: 'color-mix(in srgb, var(--danger) 8%, var(--bg-panel))',
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', flex: 1, minWidth: 0 }}>
          ⚠ Conflict — edit the file to resolve, then mark as resolved
        </span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <ActionButton
            label="Use Ours"
            title="Accept the local (HEAD) version of this file"
            onClick={() => oursMutation.mutate()}
            disabled={isPending}
            color="var(--acc)"
          />
          <ActionButton
            label="Use Theirs"
            title="Accept the incoming (merging branch) version of this file"
            onClick={() => theirsMutation.mutate()}
            disabled={isPending}
            color="var(--success)"
          />
          <ActionButton
            label="External Tool"
            title="Open in the configured git merge tool"
            onClick={() => openToolMutation.mutate()}
            disabled={openToolMutation.isPending}
            color="var(--text-sec)"
            subtle
          />
          <ActionButton
            label="Mark Resolved"
            title="Stage the file after manually resolving conflicts"
            onClick={() => markResolvedMutation.mutate()}
            disabled={isPending}
            color="var(--warn)"
          />
        </div>
      </div>

      {/* File content */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-content)' }}>
        {isLoading ? (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--text-ter)' }}>Loading…</div>
        ) : (
          <ConflictContent content={content ?? ''} />
        )}
      </div>
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

        // Transition region based on markers
        if (line.startsWith('<<<<<<<')) {
          region = 'ours'
          bg = 'color-mix(in srgb, var(--acc) 18%, transparent)'
          color = 'var(--acc)'
          fontWeight = 700
        } else if (line.startsWith('=======')) {
          region = 'theirs'
          bg = 'color-mix(in srgb, var(--border) 40%, transparent)'
          color = 'var(--text-ter)'
          fontWeight = 700
        } else if (line.startsWith('>>>>>>>')) {
          const prevRegion = region
          region = 'normal'
          bg = prevRegion === 'theirs'
            ? 'color-mix(in srgb, var(--success) 18%, transparent)'
            : 'transparent'
          color = 'var(--success)'
          fontWeight = 700
        } else {
          if (region === 'ours') bg = 'color-mix(in srgb, var(--acc) 8%, transparent)'
          if (region === 'theirs') bg = 'color-mix(in srgb, var(--success) 8%, transparent)'
        }

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              background: bg,
              borderLeft: region === 'ours' ? '3px solid var(--acc)' :
                          region === 'theirs' ? '3px solid var(--success)' :
                          '3px solid transparent',
            }}
          >
            {/* Line number */}
            <span style={{
              flexShrink: 0, width: 44, textAlign: 'right',
              padding: '0 8px', fontSize: 11,
              color: 'var(--text-ter)', userSelect: 'none',
              borderRight: '1px solid var(--border-sub)',
            }}>
              {i + 1}
            </span>
            {/* Content */}
            <span style={{
              flex: 1, padding: '0 12px', whiteSpace: 'pre',
              color, fontWeight, overflow: 'hidden',
            }}>
              {line || ' '}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Shared button ────────────────────────────────────────────────────────────

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
        padding: '4px 10px',
        borderRadius: 5,
        border: subtle ? `1px solid var(--border)` : 'none',
        background: subtle ? 'transparent' : `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
