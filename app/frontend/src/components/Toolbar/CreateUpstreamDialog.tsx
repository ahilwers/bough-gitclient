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

import { Button } from '../shared/Button'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import type { PushInfo } from '@bindings/bough/git'

interface Props {
  info: PushInfo
  onConfirm: (remote: string) => void
  onClose: () => void
}

export function CreateUpstreamDialog({ info, onConfirm, onClose }: Props) {
  const { t } = useTranslation()
  // With multiple remotes, require a deliberate selection instead of assuming origin.
  const remotes = info.remotes ?? []
  const [remote, setRemote] = useState(remotes.length === 1 ? remotes[0] : '')
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }} />
        <Dialog.Content
          onOpenAutoFocus={event => {
            event.preventDefault()
            cancelRef.current?.focus()
          }}
          style={{
            position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            width: 420, background: 'var(--bg-panel)', borderRadius: 10,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)', zIndex: 50, padding: 24,
          }}
        >
          <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-pri)', marginBottom: 8 }}>
            {t('push.createUpstream.title')}
          </Dialog.Title>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 20 }}>
            {t('push.createUpstream.description', { branch: info.branch })}
          </Dialog.Description>
          {remotes.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-sec)' }}>{t('push.createUpstream.noRemotes')}</p>
          ) : (
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-pri)' }}>
              {t('push.createUpstream.remote')}
              <select aria-label={t('push.createUpstream.remote')} value={remote} onChange={event => setRemote(event.target.value)}
                style={{ padding: 7, background: 'var(--bg-content)', color: 'var(--text-pri)', border: '1px solid var(--border)', borderRadius: 6 }}>
                <option value="" disabled>{t('push.createUpstream.selectRemote')}</option>
                {remotes.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          )}
          {remote && <p style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 12 }}>{t('push.createUpstream.preview', { upstream: `${remote}/${info.branch}` })}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <Dialog.Close asChild>
              <Button ref={cancelRef} variant="secondary">{t('push.createUpstream.cancel')}</Button>
            </Dialog.Close>
            <Button disabled={!remote} onClick={() => onConfirm(remote)}
              variant="primary">
              {t('push.createUpstream.confirm')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
