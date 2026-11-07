import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PrepareBranchDeletion, DeleteBranch } from '@wailsjs/go/main/App'
import type { git } from '@wailsjs/go/models'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'
import { Button } from '../shared/Button'

interface Target {
  name: string
  remote: string
  isRemote: boolean
  repo: string
  worktree: string | null
}

export function DeleteBranchDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const tr = (key: string, en: string, de: string) => t(`deleteBranch.${key}`, { defaultValue: i18n.language.startsWith('de') ? de : en })
  const client = useQueryClient()
  const [info, setInfo] = useState<git.BranchDeletionInfo | null>(null)
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
      setError(tr('missingRemote', 'Cannot delete a remote branch without a known remote.', 'Ein Remote-Branch ohne bekanntes Remote kann nicht gelöscht werden.'))
    } else if (!target.isRemote && target.remote) {
      setError(tr('unexpectedRemote', 'Local branch has an unexpected remote.', 'Der lokale Branch hat ein unerwartetes Remote.'))
    } else {
      PrepareBranchDeletion(target.name, target.remote).then(snapshot => {
        if (!alive || !valid.current || !sameContext()) return
        if (!snapshot || snapshot.name !== target.name || snapshot.remote !== target.remote || !snapshot.ref || !snapshot.oid || (target.isRemote && (!snapshot.remote || !snapshot.destination)) || (!target.isRemote && snapshot.remote)) {
          setError(tr('invalidSnapshot', 'Could not prepare a complete branch deletion snapshot.', 'Das Löschziel konnte nicht vollständig und eindeutig ermittelt werden.'))
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

  const submit = async () => {
    if (!info || busy.current || !valid.current || !sameContext()) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      await DeleteBranch(info)
      if (valid.current && sameContext()) {
        const message = target.isRemote
          ? tr('remoteSuccess', 'Remote branch deleted', 'Remote-Branch gelöscht')
          : tr('localSuccess', 'Local branch deleted', 'Lokaler Branch gelöscht')
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
            {target.isRemote ? tr('remoteTitle', 'Delete remote branch?', 'Remote-Branch löschen?') : tr('localTitle', 'Delete local branch?', 'Lokalen Branch löschen?')}
          </Dialog.Title>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--text-sec)' }}>
            {target.isRemote
              ? tr('remoteWarning', 'This deletes the branch at the push destination shown below and affects other users. If fetch and push destinations differ, the local remote-tracking entry may remain.', 'Der Branch wird am unten angezeigten Push-Ziel auf dem Server gelöscht. Dies betrifft auch andere Benutzer. Bei unterschiedlichen Fetch- und Push-Zielen kann der lokale Remote-Tracking-Eintrag bestehen bleiben.')
              : tr('localWarning', 'This deletes only the local branch, not the branch on the server. Git checks whether the branch is merged; force deletion is not offered.', 'Nur der lokale Branch wird gelöscht, nicht der Branch auf dem Server. Git prüft, ob der Branch gemergt ist; erzwungenes Löschen wird nicht angeboten.')}
          </Dialog.Description>
          <p>Branch: <strong>{target.name}</strong></p>
          {!info && !error && <p role="status">{tr('loading', 'Preparing deletion…', 'Löschung wird vorbereitet…')}</p>}
          {info && <div style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
            <p>{target.isRemote ? tr('serverRef', 'Server ref', 'Server-Ref') : tr('localRef', 'Local ref', 'Lokaler Ref')}: {info.ref}</p>
            {target.isRemote && <><p>Remote: {info.remote}</p><p>{tr('destination', 'Destination', 'Ziel')}: {info.destination}</p><p>{tr('destinationId', 'For network URLs, the SHA-256 identifier distinguishes the push destination without displaying credentials or paths.', 'Bei Netzwerk-URLs unterscheidet die SHA-256-Kennung das Push-Ziel, ohne Zugangsdaten oder Pfade anzuzeigen.')}</p></>}
            <p>OID: {info.oid}</p>
          </div>}
          {error && <p role="alert" style={{ color: 'var(--danger)', overflowWrap: 'anywhere' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <Dialog.Close asChild><Button ref={cancel} variant="secondary" disabled={pending}>{tr('cancel', 'Cancel', 'Abbrechen')}</Button></Dialog.Close>
            <Button variant="danger" disabled={!info || pending} onClick={submit}>{pending ? tr('pending', 'Deleting…', 'Wird gelöscht…') : tr('confirm', 'Delete Branch', 'Branch löschen')}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
