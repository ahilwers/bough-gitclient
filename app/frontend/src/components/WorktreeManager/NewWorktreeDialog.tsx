import { useState, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertCircle } from 'lucide-react'
import { useBranches } from '@/hooks/useBranches'
import { useWorktrees } from '@/hooks/useWorktrees'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'

interface Props {
  onClose: () => void
}

export function NewWorktreeDialog({ onClose }: Props) {
  const { data: branches } = useBranches()
  const { addMutation } = useWorktrees()
  const showFlash = useGitStore(s => s.showFlash)

  const [selectedBranch, setSelectedBranch] = useState('')
  const [pathInput, setPathInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const allBranches = useMemo(() => {
    const local = branches?.local?.map(b => b.name) ?? []
    const remotes = branches?.remotes?.map(b => b.name) ?? []
    return [...local, ...remotes]
  }, [branches])

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!selectedBranch) next.branch = 'Select a branch'
    if (!pathInput.trim()) next.path = 'Enter a path'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleBranchSelect = (branch: string) => {
    setSelectedBranch(branch)
    if (!pathInput) {
      setPathInput('../' + branch.replace(/\//g, '-'))
    }
  }

  const handleSubmit = () => {
    if (!validate()) return
    addMutation.mutate(
      { path: pathInput.trim(), branch: selectedBranch },
      {
        onSuccess: () => {
          showFlash('Worktree created', 'success')
          onClose()
        },
        onError: (err: Error) => {
          showFlash(parseGitError(err), 'danger')
        },
      }
    )
  }

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 40,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 384,
            background: 'var(--bg-panel)',
            borderRadius: 10,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            zIndex: 50,
            padding: 24,
          }}
        >
          {/* Close */}
          <Dialog.Close
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-sec)',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              borderRadius: 4,
            }}
          >
            <X size={16} />
          </Dialog.Close>

          <Dialog.Title
            style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-pri)', marginBottom: 4 }}
          >
            Create New Worktree
          </Dialog.Title>

          <Dialog.Description
            style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 20 }}
          >
            Create a linked working directory for a different branch.
          </Dialog.Description>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Branch selector */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-pri)', marginBottom: 6 }}>
                Branch <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                value={selectedBranch}
                onChange={e => handleBranchSelect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${errors.branch ? 'var(--danger)' : 'var(--border)'}`,
                  background: 'var(--bg-content)',
                  color: 'var(--text-pri)',
                  fontSize: 13,
                  outline: 'none',
                }}
              >
                <option value="">Select a branch…</option>
                {allBranches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {errors.branch && <FieldError message={errors.branch} />}
            </div>

            {/* Path input */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-pri)', marginBottom: 6 }}>
                Path <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={pathInput}
                onChange={e => setPathInput(e.target.value)}
                placeholder="../branch-name"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${errors.path ? 'var(--danger)' : 'var(--border)'}`,
                  background: 'var(--bg-content)',
                  color: 'var(--text-pri)',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {errors.path && <FieldError message={errors.path} />}
              <p style={{ fontSize: 11, color: 'var(--text-ter)', marginTop: 4 }}>
                Relative or absolute path for the new working directory
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <Dialog.Close asChild>
              <button
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-pri)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSubmit}
              disabled={addMutation.isPending}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--acc)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: addMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: addMutation.isPending ? 0.6 : 1,
              }}
            >
              {addMutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function FieldError({ message }: { message: string }) {
  return (
    <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
      <AlertCircle size={11} />
      {message}
    </p>
  )
}
