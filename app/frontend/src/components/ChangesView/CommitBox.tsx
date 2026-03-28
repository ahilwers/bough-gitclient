import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateCommit, AmendCommit } from '@wailsjs/go/main/App'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'

export function CommitBox() {
  const queryClient = useQueryClient()
  const { showFlash } = useGitStore()
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['status'] })
    queryClient.invalidateQueries({ queryKey: ['commits'] })
    queryClient.invalidateQueries({ queryKey: ['diff'] })
  }

  const commitMutation = useMutation({
    mutationFn: async (msg: string) => {
      if (amend) return AmendCommit(msg)
      return CreateCommit(msg)
    },
    onSuccess: () => {
      setMessage('')
      setAmend(false)
      invalidate()
      showFlash(amend ? 'Commit amended' : 'Changes committed')
    },
    onError: (err: Error) => showFlash(`Commit failed: ${parseGitError(err)}`, 'danger'),
  })

  const disabled = !message.trim() || commitMutation.isPending

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!disabled) commitMutation.mutate(message)
    }
  }

  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid var(--border-sub)',
      background: 'var(--bg-panel)',
      padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe your changes…"
        rows={4}
        style={{
          width: '100%', padding: '8px 10px', boxSizing: 'border-box',
          border: '1px solid var(--border)', borderRadius: 6,
          background: 'var(--bg-input)', color: 'var(--text-pri)',
          fontSize: 12, fontFamily: 'monospace',
          resize: 'none', outline: 'none',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--acc)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, color: 'var(--text-sec)', cursor: 'pointer', userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={amend}
            onChange={e => setAmend(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Amend last commit
        </label>

        <button
          onClick={() => commitMutation.mutate(message)}
          disabled={disabled}
          style={{
            marginLeft: 'auto',
            padding: '6px 16px', borderRadius: 5, border: 'none',
            fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
            background: disabled ? 'var(--bg-badge)' : 'var(--acc)',
            color: disabled ? 'var(--text-ter)' : 'white',
            transition: 'background 0.1s',
          }}
        >
          {commitMutation.isPending ? 'Committing…' : amend ? 'Amend' : 'Commit'}
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 10, color: 'var(--text-ter)' }}>
        Press{' '}
        <kbd style={{ padding: '1px 4px', background: 'var(--bg-badge)', borderRadius: 3, fontFamily: 'monospace', fontSize: 10 }}>
          ⌘ Enter
        </kbd>
        {' '}to commit
      </p>
    </div>
  )
}
