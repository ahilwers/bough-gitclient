// Copyright (C) 2026 Achim Hilwers
//
// This file is part of Bough.
//
// Bough is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { CreateTag, GetCommits } from '@wailsjs/go/main/App'
import { useCreateDialogContext } from '@/hooks/useCreateDialogContext'
import { parseGitError } from '@/lib/format'
import { useGitStore } from '@/stores/gitStore'

interface Props {
  onClose: () => void
}

/** Mount to open; unmount via onClose. Tags the HEAD resolved when opened. */
export function CreateTagDialog({ onClose }: Props) {
  const { t, i18n } = useTranslation()
  const tr = (key: string, en: string, de: string) => t(`createTag.${key}`, {
    defaultValue: i18n.language.startsWith('de') ? de : en,
  })
  const queryClient = useQueryClient()
  const showFlash = useGitStore(s => s.showFlash)
  const context = useCreateDialogContext()
  const [name, setName] = useState('')
  const [head, setHead] = useState('')
  const [headError, setHeadError] = useState('')
  const [error, setError] = useState('')
  const pending = useRef(false)

  useEffect(() => {
    let active = true
    if (context.isCurrent()) {
      // GetCommits(1, false) runs `git log -n1` without --all, i.e. from the
      // current worktree's HEAD. Do not use cached history or selectedCommit.
      void GetCommits(1, false).then(commits => {
        if (!active || !context.isCurrent()) return
        const hash = commits?.[0]?.hash ?? ''
        if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(hash)) {
          throw new Error('No valid HEAD commit')
        }
        setHead(hash)
      }).catch(err => {
        if (active && context.isCurrent()) setHeadError(parseGitError(err) || 'Unknown error')
      })
    }
    return () => { active = false }
  }, [context.isCurrent])

  const mutation = useMutation({
    mutationFn: ({ name, target }: { name: string; target: string }) => {
      if (!context.isCurrent()) throw new Error(tr('contextChanged', 'Repository or worktree changed. Close and reopen this dialog.', 'Repository oder Worktree wurde gewechselt. Dialog schließen und erneut öffnen.'))
      return CreateTag(name, target)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
      void queryClient.invalidateQueries({ queryKey: ['commits'] })
      showFlash(tr('success', 'Tag created', 'Tag erstellt'), 'success')
      onClose()
    },
    onError: (err: unknown) => setError(parseGitError(err) || tr('failed', 'Could not create tag.', 'Tag konnte nicht erstellt werden.')),
    onSettled: () => { pending.current = false },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (pending.current || !context.isCurrent() || !head || !name.trim()) return
    pending.current = true
    setError('')
    mutation.mutate({ name, target: head })
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
          <Dialog.Title style={titleStyle}>{tr('title', 'Create Tag', 'Tag erstellen')}</Dialog.Title>
          <Dialog.Description style={descriptionStyle}>
            {tr('description', 'Create a lightweight tag at the HEAD commit resolved when this dialog opened. Later HEAD changes do not change the target.', 'Ein leichtgewichtiges Tag auf den beim Öffnen ermittelten HEAD-Commit erstellen. Spätere HEAD-Änderungen ändern das Ziel nicht.')}
          </Dialog.Description>
          <form onSubmit={submit}>
            <label htmlFor="tag-name" style={labelStyle}>{tr('name', 'Tag name', 'Tag-Name')}</label>
            <input id="tag-name" autoFocus value={name} onChange={event => { setName(event.target.value); setError('') }} disabled={busy || !context.valid} style={inputStyle} />
            <div style={{ marginTop: 16, fontSize: 12 }} aria-live="polite">
              <span style={labelStyle}>{tr('head', 'HEAD commit', 'HEAD-Commit')}</span>
              {head ? <code style={{ overflowWrap: 'anywhere', color: 'var(--text-sec)' }}>{head}</code>
                : !headError && context.valid ? <span style={{ color: 'var(--text-sec)' }}>{tr('loading', 'Resolving HEAD…', 'HEAD wird ermittelt…')}</span> : null}
            </div>
            {(contextError || headError || error) && <p role="alert" style={errorStyle}>
              {contextError || (headError ? `${tr('headError', 'Could not resolve HEAD', 'HEAD konnte nicht ermittelt werden')}: ${headError}` : error)}
            </p>}
            <div style={actionsStyle}>
              <Dialog.Close asChild><button type="button" style={cancelStyle} disabled={busy}>{tr('cancel', 'Cancel', 'Abbrechen')}</button></Dialog.Close>
              <button type="submit" style={{ ...primaryStyle, opacity: busy || !context.valid || !head || !name.trim() ? 0.6 : 1 }} disabled={busy || !context.valid || !head || !name.trim()}>
                {busy ? tr('pending', 'Creating…', 'Wird erstellt…') : tr('submit', 'Create Tag', 'Tag erstellen')}
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
