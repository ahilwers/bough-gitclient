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
import { useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'

export function PullStrategyDialog({ branch, onChoose, onClose }: { branch: string; onChoose: (strategy: 'merge' | 'rebase') => void; onClose: () => void }) {
  const { t } = useTranslation()
  const cancel = useRef<HTMLButtonElement>(null)
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
      <Dialog.Content onOpenAutoFocus={e => { e.preventDefault(); cancel.current?.focus() }} style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 460, maxWidth: 'calc(100vw - 32px)', padding: 24, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', zIndex: 1001, color: 'var(--text-pri)' }}>
        <Dialog.Title style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t('pull.title')}</Dialog.Title>
        <Dialog.Description style={{ fontSize: 13, color: 'var(--text-sec)', lineHeight: 1.5 }}>{t('pull.description', { branch })}</Dialog.Description>
        <div style={{ margin: '20px 0', display: 'grid', gap: 12, fontSize: 13, lineHeight: 1.5 }}>
          <p><strong>{t('pull.merge')}</strong><br />{t('pull.mergeExplanation')}</p>
          <p><strong>{t('pull.rebase')}</strong><br />{t('pull.rebaseExplanation')}</p>
          <p style={{ color: 'var(--text-sec)' }}>{t('pull.once')}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" ref={cancel} onClick={onClose}>{t('pull.cancel')}</Button>
          <Button variant="secondary" onClick={() => onChoose('merge')}>{t('pull.merge')}</Button>
          <Button variant="secondary" onClick={() => onChoose('rebase')}>{t('pull.rebase')}</Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
