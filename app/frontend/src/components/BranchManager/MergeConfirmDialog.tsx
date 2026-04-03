import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useBranches } from '@/hooks/useBranches'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'

interface Props {
  fromBranch: string   // branch being merged in
  intoBranch: string   // current/HEAD branch (merge target)
  onClose: () => void
}

export function MergeConfirmDialog({ fromBranch, intoBranch, onClose }: Props) {
  const { mergeMutation } = useBranches()
  const showFlash = useGitStore(s => s.showFlash)

  const handleMerge = () => {
    mergeMutation.mutate(fromBranch, {
      onSuccess: () => {
        showFlash(`Merged '${fromBranch}' into '${intoBranch}'`, 'success')
        onClose()
      },
      onError: (err: Error) => {
        showFlash(parseGitError(err), 'danger')
        onClose()
      },
    })
  }

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }} />
        <Dialog.Content
          style={{
            position: 'fixed', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 420,
            background: 'var(--bg-panel)',
            borderRadius: 10,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            zIndex: 50,
            padding: 24,
          }}
        >
          <Dialog.Close
            aria-label="Close"
            style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', display: 'flex', padding: 4, borderRadius: 4 }}
          >
            <X size={16} />
          </Dialog.Close>

          <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-pri)', marginBottom: 4 }}>
            Merge Branch
          </Dialog.Title>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 20 }}>
            Merge <strong style={{ color: 'var(--text-pri)' }}>{fromBranch}</strong> into <strong style={{ color: 'var(--text-pri)' }}>{intoBranch}</strong>.
          </Dialog.Description>

          <MergeVisualization fromBranch={fromBranch} intoBranch={intoBranch} />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <Dialog.Close asChild>
              <button style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'none', color: 'var(--text-pri)', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleMerge}
              disabled={mergeMutation.isPending}
              style={{
                padding: '7px 14px', borderRadius: 6, border: 'none',
                background: 'var(--acc)', color: '#fff',
                fontSize: 13, fontWeight: 500,
                cursor: mergeMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: mergeMutation.isPending ? 0.6 : 1,
              }}
            >
              {mergeMutation.isPending ? 'Merging…' : 'Merge'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── SVG merge visualization ──────────────────────────────────────────────────

function MergeVisualization({ fromBranch, intoBranch }: { fromBranch: string; intoBranch: string }) {
  const W = 372
  const H = 100

  // into-branch (HEAD) — bottom lane
  const intoY = 72
  const intoCommits = [48, 110, 172]

  // from-branch — top lane
  const fromY = 28
  const fromCommits = [48, 110, 172, 232]

  // Merge commit position
  const mergeX = 336
  const mergeY = (fromY + intoY) / 2   // midpoint = 50

  // Bezier: from-branch curves down to merge commit
  const fromCp1x = fromCommits[fromCommits.length - 1] + 30
  const fromCp1y = fromY
  const fromCp2x = mergeX - 30
  const fromCp2y = mergeY

  // Bezier: into-branch curves up to merge commit
  const intoCp1x = intoCommits[intoCommits.length - 1] + 30
  const intoCp1y = intoY
  const intoCp2x = mergeX - 30
  const intoCp2y = mergeY

  const clip = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + '…' : s

  return (
    <div style={{
      borderRadius: 8,
      border: '1px solid var(--border-sub)',
      background: 'var(--bg-content)',
      overflow: 'hidden',
    }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>

        {/* ── from-branch line ── */}
        <line
          x1={fromCommits[0]} y1={fromY}
          x2={fromCommits[fromCommits.length - 1] + 10} y2={fromY}
          stroke="var(--success)" strokeWidth="2"
        />
        {fromCommits.slice(0, -1).map(cx => (
          <circle key={cx} cx={cx} cy={fromY} r={3.5} fill="var(--success)" />
        ))}
        {/* from-branch HEAD dot */}
        <circle cx={fromCommits[fromCommits.length - 1]} cy={fromY} r={6} fill="var(--bg-content)" stroke="var(--success)" strokeWidth="2" />
        <circle cx={fromCommits[fromCommits.length - 1]} cy={fromY} r={3} fill="var(--success)" />

        {/* from-branch label */}
        <rect x={fromCommits[0] - 4} y={fromY - 16} width={72} height={13} rx={3} fill="var(--success)" opacity={0.15} />
        <text x={fromCommits[0] + 32} y={fromY - 6} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="var(--success)" fontWeight="600">
          {clip(fromBranch, 12)}
        </text>

        {/* bezier from from-branch HEAD to merge commit */}
        <path
          d={`M ${fromCommits[fromCommits.length - 1]} ${fromY} C ${fromCp1x} ${fromCp1y}, ${fromCp2x} ${fromCp2y}, ${mergeX} ${mergeY}`}
          fill="none" stroke="var(--success)" strokeWidth="2"
        />

        {/* ── into-branch line ── */}
        <line
          x1={intoCommits[0]} y1={intoY}
          x2={intoCommits[intoCommits.length - 1] + 10} y2={intoY}
          stroke="var(--acc)" strokeWidth="2"
        />
        {intoCommits.slice(0, -1).map(cx => (
          <circle key={cx} cx={cx} cy={intoY} r={3.5} fill="var(--acc)" />
        ))}
        {/* into-branch HEAD dot */}
        <circle cx={intoCommits[intoCommits.length - 1]} cy={intoY} r={6} fill="var(--bg-content)" stroke="var(--acc)" strokeWidth="2" />
        <circle cx={intoCommits[intoCommits.length - 1]} cy={intoY} r={3} fill="var(--acc)" />

        {/* HEAD label */}
        <text x={intoCommits[intoCommits.length - 1]} y={intoY + 19} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="var(--acc)" fontWeight="600">
          HEAD
        </text>

        {/* into-branch name chip */}
        <rect x={intoCommits[0] - 4} y={intoY + 10} width={72} height={13} rx={3} fill="var(--acc)" opacity={0.15} />
        <text x={intoCommits[0] + 32} y={intoY + 20} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="var(--acc)" fontWeight="600">
          {clip(intoBranch, 12)}
        </text>

        {/* bezier from into-branch HEAD to merge commit */}
        <path
          d={`M ${intoCommits[intoCommits.length - 1]} ${intoY} C ${intoCp1x} ${intoCp1y}, ${intoCp2x} ${intoCp2y}, ${mergeX} ${mergeY}`}
          fill="none" stroke="var(--acc)" strokeWidth="2"
        />

        {/* ── merge commit ── */}
        <circle cx={mergeX} cy={mergeY} r={8} fill="var(--bg-content)" stroke="var(--warn)" strokeWidth="2.5" />
        <circle cx={mergeX} cy={mergeY} r={4} fill="var(--warn)" />

        {/* merge label */}
        <text x={mergeX} y={mergeY - 13} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="var(--warn)" fontWeight="700">
          MERGE
        </text>
      </svg>
    </div>
  )
}
