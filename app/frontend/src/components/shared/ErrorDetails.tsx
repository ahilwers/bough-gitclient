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

import { useCallback, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

/**
 * True when Git's message no longer fits into a toast without cutting it. The
 * toast shows three lines; everything beyond that is only in the details.
 */
export function isLongMessage(message: string): boolean {
  const lines = message.split('\n').filter(line => line.trim() !== '')
  return lines.length > 3 || message.length > 220
}

/**
 * Renders the message of a failed Git call exactly as Git printed it, plus a
 * link to the complete text when the message is too long for the place it is
 * shown in.
 */
export function ErrorMessage({ message }: { message: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message}</span>
      {isLongMessage(message) && (
        <Button
          variant="ghost"
          onClick={() => setOpen(true)}
          style={{ marginLeft: 6, fontSize: 11, padding: '0 4px', color: 'var(--acc)' }}
        >
          {t('errors.details')}
        </Button>
      )}
      {open && <ErrorDetails text={message} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Shows the complete output of a failed Git command, unmodified. */
export function ErrorDetails({ text, onClose }: { text: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }, [text])

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'color-mix(in srgb, var(--text-pri) 45%, transparent)',
        }} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            width: 620, maxWidth: 'calc(100vw - 32px)',
            display: 'flex', flexDirection: 'column', gap: 12,
            padding: 20,
            background: 'var(--bg-panel)', color: 'var(--text-pri)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--shadow-lg)', zIndex: 10001,
          }}
        >
          <Dialog.Title style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
            {t('errors.title')}
          </Dialog.Title>
          <pre
            data-testid="error-details-text"
            style={{
              margin: 0, minHeight: 80, maxHeight: '55vh', overflow: 'auto',
              whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.5,
              background: 'var(--bg-badge)', border: '1px solid var(--border-sub)',
              borderRadius: 'var(--r-sm)', padding: 12,
            }}
          >
            {text}
          </pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" onClick={copy}>{copied ? t('errors.copied') : t('errors.copy')}</Button>
            <Dialog.Close asChild><Button variant="primary">{t('errors.close')}</Button></Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
