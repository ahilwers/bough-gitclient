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

import { useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { DiagnosticMessage } from '../shared/ErrorDetails'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { CreateStash } from '@bindings/gitmorrow/app'
import { useCreateDialogContext } from '@/hooks/useCreateDialogContext'
import { parseGitError } from '@/lib/format'
import { useGitStore } from '@/stores/gitStore'

interface Props {
  onClose: () => void
}

/** Mount to open; unmount via onClose. Does not change the selected worktree. */
export function CreateStashDialog({ onClose }: Props) {
  const { t, i18n } = useTranslation()
  const tr = (key: string, en: string, de: string) => t(`createStash.${key}`, {
    defaultValue: i18n.language.startsWith('de') ? de : en,
  })
  const queryClient = useQueryClient()
  const showFlash = useGitStore(s => s.showFlash)
  const context = useCreateDialogContext()
  const [message, setMessage] = useState('')
  const [includeUntracked, setIncludeUntracked] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)

  const mutation = useMutation({
    mutationFn: ({ message, includeUntracked }: { message: string; includeUntracked: boolean }) => {
      if (!context.isCurrent()) throw new Error(tr('contextChanged', 'Repository or worktree changed. Close and reopen this dialog.', 'Repository oder Worktree wurde gewechselt. Dialog schließen und erneut öffnen.'))
      return CreateStash(message, includeUntracked)
    },
    onSuccess: () => {
      // Stash indices shift on creation; close any index-based view first.
      window.dispatchEvent(new Event('stash:created'))
      for (const key of ['stashes', 'stashDiff', 'status', 'diff', 'commits', 'worktrees']) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
      showFlash(tr('success', 'Stash created', 'Stash erstellt'), 'success')
      onClose()
    },
    onError: (err: unknown) => setError(parseGitError(err) || tr('failed', 'Could not create stash.', 'Stash konnte nicht erstellt werden.')),
    onSettled: () => { pending.current = false },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (pending.current || !context.isCurrent()) return
    pending.current = true
    setError('')
    mutation.mutate({ message, includeUntracked })
  }

  const busy = mutation.isPending
  const contextError = !context.valid
    ? tr('contextChanged', 'Repository or worktree changed. Close and reopen this dialog.', 'Repository oder Worktree wurde gewechselt. Dialog schließen und erneut öffnen.')
    : ''

  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !pending.current) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content
          style={contentStyle}
          onEscapeKeyDown={event => { if (pending.current) event.preventDefault() }}
          onPointerDownOutside={event => { if (pending.current) event.preventDefault() }}
        >
          <Dialog.Close aria-label={tr('close', 'Close', 'Schließen')} disabled={busy} style={closeStyle}><X size={16} /></Dialog.Close>
          <Dialog.Title style={titleStyle}>{tr('title', 'Create Stash', 'Stash erstellen')}</Dialog.Title>
          <Dialog.Description style={descriptionStyle}>
            {tr('description', 'Staged and unstaged changes are saved in a stash and removed from the working directory and index. Untracked files are excluded unless you choose to include them.', 'Vorgemerkte und nicht vorgemerkte Änderungen werden im Stash gespeichert und aus Arbeitsverzeichnis und Index entfernt. Nicht verfolgte Dateien werden nur auf Wunsch einbezogen.')}
          </Dialog.Description>
          <form onSubmit={submit}>
            <label htmlFor="stash-message" style={labelStyle}>{tr('message', 'Message (optional)', 'Nachricht (optional)')}</label>
            <input id="stash-message" autoFocus value={message} onChange={event => setMessage(event.target.value)} disabled={busy || !context.valid} style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, color: 'var(--text-pri)' }}>
              <input type="checkbox" checked={includeUntracked} onChange={event => setIncludeUntracked(event.target.checked)} disabled={busy || !context.valid} style={{ accentColor: 'var(--acc)' }} />
              {tr('untracked', 'Include untracked files (optional)', 'Nicht verfolgte Dateien einbeziehen (optional)')}
            </label>
            {(contextError || error) && <p role="alert" style={errorStyle}><DiagnosticMessage message={contextError || error} /></p>}
            <div style={actionsStyle}>
              <Dialog.Close asChild><button type="button" style={cancelStyle} disabled={busy}>{tr('cancel', 'Cancel', 'Abbrechen')}</button></Dialog.Close>
              <button type="submit" style={{ ...primaryStyle, opacity: busy || !context.valid ? 0.6 : 1 }} disabled={busy || !context.valid}>
                {busy ? tr('pending', 'Creating…', 'Wird erstellt…') : tr('submit', 'Create Stash', 'Stash erstellen')}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const overlayStyle: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }
const contentStyle: CSSProperties = { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 420, maxWidth: 'calc(100vw - 32px)', padding: 24, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', zIndex: 1001, color: 'var(--text-pri)' }
const closeStyle: CSSProperties = { position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)', display: 'flex', padding: 4 }
const titleStyle: CSSProperties = { fontSize: 16, fontWeight: 600, marginBottom: 8 }
const descriptionStyle: CSSProperties = { fontSize: 13, color: 'var(--text-sec)', lineHeight: 1.5, marginBottom: 20 }
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }
const inputStyle: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-content)', color: 'var(--text-pri)', fontSize: 13 }
const errorStyle: CSSProperties = { fontSize: 12, color: 'var(--danger)', marginTop: 12, whiteSpace: 'pre-wrap' }
const actionsStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }
const cancelStyle: CSSProperties = { padding: '7px 14px', borderRadius: 6, border: 'none', background: 'none', color: 'var(--text-pri)', fontSize: 13, cursor: 'pointer' }
const primaryStyle: CSSProperties = { padding: '7px 14px', borderRadius: 6, border: 'none', background: 'var(--acc)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
