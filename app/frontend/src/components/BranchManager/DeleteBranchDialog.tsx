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

import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PrepareBranchDeletion, DeleteBranch } from '@bindings/gitmorrow/app'
import type { BranchDeletionInfo } from '@bindings/gitmorrow/git'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'
import { DiagnosticMessage } from '../shared/ErrorDetails'
import { Button } from '../shared/Button'

interface Target {
  name: string
  remote: string
  isRemote: boolean
  repo: string
  worktree: string | null
}

export function DeleteBranchDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [info, setInfo] = useState<BranchDeletionInfo | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const valid = useRef(true)
  const cancel = useRef<HTMLButtonElement>(null)
  const sameContext = () => {
    const { activeRepo, activeWorktree } = useGitStore.getState()
    return activeRepo === target.repo && activeWorktree === target.worktree
  }

  useEffect(() => {
    valid.current = true
    let alive = true
    const unsubscribe = useGitStore.subscribe(state => {
      if (state.activeRepo !== target.repo || state.activeWorktree !== target.worktree) {
        valid.current = false
        onClose()
      }
    })
    if (!sameContext()) {
      valid.current = false
      onClose()
    } else if (target.isRemote && !target.remote) {
      setError(t('deleteBranch.missingRemote'))
    } else if (!target.isRemote && target.remote) {
      setError(t('deleteBranch.unexpectedRemote'))
    } else {
      PrepareBranchDeletion(target.name, target.remote).then(snapshot => {
        if (!alive || !valid.current || !sameContext()) return
        if (!snapshot || snapshot.name !== target.name || snapshot.remote !== target.remote || !snapshot.ref || !snapshot.oid || (target.isRemote && (!snapshot.remote || !snapshot.destination)) || (!target.isRemote && snapshot.remote)) {
          setError(t('deleteBranch.invalidSnapshot'))
          return
        }
        setInfo(snapshot)
      }).catch(err => {
        if (alive && valid.current && sameContext()) setError(parseGitError(err))
      })
    }
    return () => { alive = false; valid.current = false; unsubscribe() }
    // The target is a snapshot for the lifetime of this dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A local branch that is not fully merged can only be deleted with force;
  // the dialog makes the loss of its unmerged commits explicit.
  const forceNeeded = !target.isRemote && info != null && !info.merged

  const submit = async (force = false) => {
    if (!info || busy.current || !valid.current || !sameContext()) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      await DeleteBranch(info, force)
      if (valid.current && sameContext()) {
        const message = target.isRemote
          ? t('deleteBranch.remoteSuccess')
          : t('deleteBranch.localSuccess')
        useGitStore.getState().showFlash(`${message}: ${target.name}`, 'success')
        onClose()
      }
    } catch (err) {
      if (valid.current && sameContext()) {
        const message = parseGitError(err)
        setError(message)
        useGitStore.getState().showFlash(message, 'danger')
      }
    } finally {
      // Even a failed network operation may have changed the remote state.
      for (const key of ['branches', 'commits', 'status', 'worktrees']) {
        void client.invalidateQueries({ queryKey: [key] })
      }
      busy.current = false
      if (valid.current) setPending(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !busy.current) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }} />
        <Dialog.Content
          onOpenAutoFocus={event => { event.preventDefault(); cancel.current?.focus() }}
          onEscapeKeyDown={event => { if (busy.current) event.preventDefault() }}
          onPointerDownOutside={event => { if (busy.current) event.preventDefault() }}
          style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 440, maxWidth: '90vw', background: 'var(--bg-panel)', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', zIndex: 50, padding: 24 }}
        >
          <Dialog.Title style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            {target.isRemote ? t('deleteBranch.remoteTitle') : t('deleteBranch.localTitle')}
          </Dialog.Title>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--text-sec)' }}>
            {target.isRemote
              ? t('deleteBranch.remoteWarning')
              : info && !info.merged
                ? t('deleteBranch.localUnmergedWarning')
                : t('deleteBranch.localWarning')}
          </Dialog.Description>
          <p>Branch: <strong>{target.name}</strong></p>
          {!info && !error && <p role="status">{t('deleteBranch.loading')}</p>}
          {info && <div style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
            <p>{target.isRemote ? t('deleteBranch.serverRef') : t('deleteBranch.localRef')}: {info.ref}</p>
            {target.isRemote && <><p>Remote: {info.remote}</p><p>{t('deleteBranch.destination')}: {info.destination}</p><p>{t('deleteBranch.destinationId')}</p></>}
            <p>OID: {info.oid}</p>
          </div>}
          {error && <p role="alert" style={{ color: 'var(--danger)', overflowWrap: 'anywhere' }}><DiagnosticMessage message={error} /></p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <Dialog.Close asChild><Button ref={cancel} variant="secondary" disabled={pending}>{t('deleteBranch.cancel')}</Button></Dialog.Close>
            <Button variant="danger" disabled={!info || pending} onClick={() => submit(forceNeeded)}>
              {pending
                ? t('deleteBranch.pending')
                : forceNeeded
                  ? t('deleteBranch.forceConfirm')
                  : t('deleteBranch.confirm')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
