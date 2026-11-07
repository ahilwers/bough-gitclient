import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertCircle } from 'lucide-react'
import { useBranches } from '@/hooks/useBranches'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'

interface Props {
  onClose: () => void
}

export function NewBranchDialog({ onClose }: Props) {
  const { data: branches, createMutation } = useBranches()
  const showFlash = useGitStore(s => s.showFlash)

  const headBranch = branches?.local?.find(b => b.isHead)?.name ?? branches?.local?.[0]?.name ?? ''

  const [sourceBranch, setSourceBranch] = useState(headBranch)
  const [branchName, setBranchName] = useState('')
  const [checkoutAfter, setCheckoutAfter] = useState(true)
  const [error, setError] = useState('')

  // Sync once branches load
  useEffect(() => {
    if (headBranch && !sourceBranch) setSourceBranch(headBranch)
  }, [headBranch])

  const handleSubmit = () => {
    if (createMutation.isPending) return
    const name = branchName.trim()
    if (!name) { setError('Branch name is required'); return }
    if (!/^[a-zA-Z0-9._\-/]+$/.test(name)) { setError('Invalid characters in branch name'); return }
    if (!sourceBranch) { setError('Select a source branch'); return }
    setError('')

    createMutation.mutate(
      { name, from: sourceBranch, checkoutAfter },
      {
        onSuccess: () => {
          showFlash(
            checkoutAfter
              ? `Created and switched to '${name}'`
              : `Created branch '${name}'`,
            'success',
          )
          onClose()
        },
        onError: (err: Error) => setError(parseGitError(err)),
      },
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
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
            New Branch
          </Dialog.Title>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 20 }}>
            Create a new branch from an existing one.
          </Dialog.Description>

          {/* Branch visualization */}
          <BranchVisualization
            sourceBranch={sourceBranch || headBranch}
            newBranchName={branchName.trim()}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            {/* Source branch */}
            <div>
              <label style={labelStyle}>
                Source Branch <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                value={sourceBranch}
                onChange={e => setSourceBranch(e.target.value)}
                style={inputStyle(false)}
              >
                {branches?.local?.map(b => (
                  <option key={b.name} value={b.name}>
                    {b.name}{b.isHead ? '  (HEAD)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* New branch name */}
            <div>
              <label style={labelStyle}>
                Branch Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={branchName}
                onChange={e => { setBranchName(e.target.value); setError('') }}
                onKeyDown={handleKeyDown}
                placeholder="feature/my-feature"
                style={inputStyle(!!error)}
              />
              {error && (
                <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                  <AlertCircle size={11} />
                  {error}
                </p>
              )}
            </div>

            {/* Checkout after */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-sec)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={checkoutAfter}
                onChange={e => setCheckoutAfter(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--acc)' }}
              />
              Switch to new branch after creating
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <Dialog.Close asChild>
              <button style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'none', color: 'var(--text-pri)', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              style={{
                padding: '7px 14px', borderRadius: 6, border: 'none',
                background: 'var(--acc)', color: '#fff',
                fontSize: 13, fontWeight: 500,
                cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: createMutation.isPending ? 0.6 : 1,
              }}
            >
              {createMutation.isPending ? 'Creating…' : 'Create Branch'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── SVG branch visualization ────────────────────────────────────────────────

function BranchVisualization({ sourceBranch, newBranchName }: { sourceBranch: string; newBranchName: string }) {
  const W = 372   // viewBox width  (matches dialog content width 420 - 24*2 padding)
  const H = 96

  // Source branch: 4 commits left-to-right, last one is HEAD
  const sourceY = 34
  const commits = [40, 100, 160, 220]
  const headX = commits[commits.length - 1]

  // New branch forks from HEAD, curves down-right
  const forkX = headX
  const forkY = sourceY
  const endX = W - 36
  const endY = H - 22

  // Bezier control points for a natural-looking fork
  const cp1x = forkX
  const cp1y = forkY + (endY - forkY) * 0.55
  const cp2x = endX - (endX - forkX) * 0.3
  const cp2y = endY

  const displayName = newBranchName || 'new-branch'
  // Clip the displayed label so it doesn't overflow
  const maxLabelChars = 22
  const label = displayName.length > maxLabelChars
    ? displayName.slice(0, maxLabelChars - 1) + '…'
    : displayName

  return (
    <div style={{
      borderRadius: 8,
      border: '1px solid var(--border-sub)',
      background: 'var(--bg-content)',
      overflow: 'hidden',
    }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: 'block' }}
      >
        {/* ── source branch line ── */}
        <line
          x1={commits[0]} y1={sourceY}
          x2={headX + 20} y2={sourceY}
          stroke="var(--acc)" strokeWidth="2"
        />
        {/* leading dots */}
        {commits.slice(0, -1).map(cx => (
          <circle key={cx} cx={cx} cy={sourceY} r={3.5} fill="var(--acc)" />
        ))}
        {/* HEAD dot — slightly larger with ring */}
        <circle cx={headX} cy={sourceY} r={6} fill="var(--bg-content)" stroke="var(--acc)" strokeWidth="2" />
        <circle cx={headX} cy={sourceY} r={3} fill="var(--acc)" />

        {/* HEAD label */}
        <text x={headX} y={sourceY - 13} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="var(--acc)" fontWeight="600">
          HEAD
        </text>

        {/* source branch name chip */}
        <rect x={commits[0] - 4} y={sourceY + 10} width={56} height={14} rx={3} fill="var(--acc)" opacity={0.15} />
        <text x={commits[0] + 24} y={sourceY + 20} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="var(--acc)" fontWeight="600">
          {sourceBranch.length > 9 ? sourceBranch.slice(0, 8) + '…' : sourceBranch}
        </text>

        {/* ── fork curve (bezier) ── */}
        <path
          d={`M ${forkX} ${forkY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`}
          fill="none"
          stroke="var(--success)"
          strokeWidth="2"
          strokeDasharray="6 3"
        />

        {/* new branch tip dot */}
        <circle cx={endX} cy={endY} r={6} fill="var(--bg-content)" stroke="var(--success)" strokeWidth="2" />
        <circle cx={endX} cy={endY} r={3} fill="var(--success)" />

        {/* new branch label */}
        <text
          x={endX}
          y={endY + 14}
          textAnchor="end"
          fontSize="9"
          fontFamily="monospace"
          fill={newBranchName ? 'var(--success)' : 'var(--text-ter)'}
          fontWeight={newBranchName ? '600' : '400'}
        >
          {label}
        </text>
      </svg>
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-pri)',
  marginBottom: 6,
}

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '6px 10px',
  borderRadius: 6,
  border: `1px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
  background: 'var(--bg-content)',
  color: 'var(--text-pri)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
})
