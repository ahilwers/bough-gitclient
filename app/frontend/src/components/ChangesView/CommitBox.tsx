// Copyright (C) 2026 Achim Hilwers
//
// This file is part of GitMorrow.
//
// GitMorrow is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { Button } from '../shared/Button'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { CreateCommit, AmendCommit } from '@bindings/gitmorrow/app'
import { useStatus } from '@/hooks/useStatus'
import { useCommits } from '@/hooks/useCommits'
import { useGitStore } from '@/stores/gitStore'
import { buildCommitMessageHistory } from '@/lib/commitMessageHistory'
import { parseGitError } from '@/lib/format'
import { AICommitAssistant } from './AICommitAssistant'

const HISTORY_COMMIT_LIMIT = 50

export function CommitBox() {
  const queryClient = useQueryClient()
  const { showFlash, pendingCherryPickMessage, setPendingCherryPickMessage, setCherryPickConflictActive, activeRepo, activeWorktree } = useGitStore()
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const { data: status } = useStatus()
  const { data: commits } = useCommits(HISTORY_COMMIT_LIMIT, false)
  const mergeMessage = status?.mergeState?.mergeMessage
  const cherryPickMessage = status?.cherryPickState?.pickedMessage

  const messageHistory = useMemo(() => buildCommitMessageHistory(commits), [commits])
  // Index into messageHistory while the user browses previous messages;
  // -1 means the textarea shows the user's own draft.
  const historyIndex = useRef(-1)
  const draft = useRef('')

  const resetHistory = () => {
    historyIndex.current = -1
    draft.current = ''
  }

  // Pre-fill message from MERGE_MSG when entering merge state.
  // Only sets once (on transition); never overwrites what the user typed.
  const prevMergeMessage = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (mergeMessage && mergeMessage !== prevMergeMessage.current) {
      setMessage(mergeMessage)
      resetHistory()
    }
    prevMergeMessage.current = mergeMessage
  }, [mergeMessage])

  // Pre-fill from cherry-pick conflict state (CHERRY_PICK_HEAD present).
  const prevCherryPickMessage = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (cherryPickMessage && cherryPickMessage !== prevCherryPickMessage.current) {
      setMessage(cherryPickMessage)
      resetHistory()
    }
    prevCherryPickMessage.current = cherryPickMessage
  }, [cherryPickMessage])

  // Pre-fill from pending cherry-pick message (no-conflict case, stored in Zustand).
  const prevPendingMessage = useRef<string | null>(null)
  useEffect(() => {
    if (pendingCherryPickMessage && pendingCherryPickMessage !== prevPendingMessage.current) {
      setMessage(pendingCherryPickMessage)
      resetHistory()
    }
    prevPendingMessage.current = pendingCherryPickMessage
  }, [pendingCherryPickMessage])

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
      resetHistory()
      setPendingCherryPickMessage(null)
      setCherryPickConflictActive(false)
      invalidate()
      showFlash(amend ? 'Commit amended' : 'Changes committed')
    },
    onError: (err: Error) => showFlash(`Commit failed: ${parseGitError(err)}`, 'danger'),
  })

  const disabled = !status || !message.trim() || commitMutation.isPending

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!disabled) commitMutation.mutate(message)
    }

    // Browse previous commit messages: ArrowUp at the very start of the text
    // walks backwards, ArrowDown at the very end walks forwards again. Any
    // other cursor position keeps the textarea's normal caret movement.
    const plainArrow = !e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey
    if (plainArrow && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const el = e.currentTarget
      const atStart = el.selectionStart === 0 && el.selectionEnd === 0
      const atEnd = el.selectionStart === message.length && el.selectionEnd === message.length

      if (e.key === 'ArrowUp' && atStart && historyIndex.current < messageHistory.length - 1) {
        e.preventDefault()
        if (historyIndex.current === -1) draft.current = message
        historyIndex.current += 1
        setMessage(messageHistory[historyIndex.current])
        // Keep the caret at the start so repeated ArrowUp continues browsing.
        requestAnimationFrame(() => el.setSelectionRange(0, 0))
        return
      }

      if (e.key === 'ArrowDown' && atEnd && historyIndex.current >= 0) {
        e.preventDefault()
        historyIndex.current -= 1
        setMessage(historyIndex.current === -1 ? draft.current : messageHistory[historyIndex.current])
        // Keep the caret at the end so repeated ArrowDown continues browsing.
        requestAnimationFrame(() => {
          const end = el.value.length
          el.setSelectionRange(end, end)
        })
        return
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      const el = document.querySelector<HTMLElement>('[data-panel="changes-filelist"]')
      el?.focus()
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      const el = document.querySelector<HTMLElement>('[data-panel="changes-diff"]')
      el?.focus()
    }
  }

  return (
    <div
      data-panel="changes-commitbox"
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--border-sub)',
        background: 'var(--bg-panel)',
        padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <AICommitAssistant key={`${activeRepo}:${activeWorktree}`} hasStaged={!!status?.files?.some(file => !!file.staged && file.staged !== ' ')} onApply={msg => { setMessage(msg); resetHistory() }} />
      <textarea
        data-commit-input
        value={message}
        onChange={e => { setMessage(e.target.value); resetHistory() }}
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

        <Button variant="primary"
          onClick={() => commitMutation.mutate(message)}
          disabled={disabled}
          style={{ marginLeft: 'auto' }}
        >
          {commitMutation.isPending
            ? <><Loader2 size={12} className="spin" style={{ marginRight: 5 }} />Committing…</>
            : amend ? 'Amend' : 'Commit'
          }
        </Button>
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
