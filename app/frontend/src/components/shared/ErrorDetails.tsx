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

import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import { ReportDiagnostic, CopyRawDiagnostic, GetDiagnostic, GetDiagnosticSettings, SetDiagnosticLogging, OpenDiagnosticFolder } from '@bindings/gitmorrow/app'
import type { Info, Status } from '@bindings/gitmorrow/internal/diagnostics/models'
import { Button } from './Button'

export function DiagnosticMessage({ message }: { message: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const id = message.match(/\s*\[git-error:([A-Za-z0-9_-]{20,64})\]/)?.[1]
  useEffect(() => { if (id) void ReportDiagnostic(id).catch(() => {}) }, [id])
  return <>
    {message.replace(/\s*\[git-error:[A-Za-z0-9_-]{20,64}\]/, '')}
    {id && <Button onClick={() => setOpen(true)}>{t('diagnostics.details')}</Button>}
    {open && id && <ErrorDetails id={id} onClose={() => setOpen(false)} />}
  </>
}

export function DiagnosticSettingsButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return <>
    <Button variant="icon" aria-label={t('diagnostics.settings')} title={t('diagnostics.settings')} onClick={() => setOpen(true)}><Settings size={14} /></Button>
    {open && <ErrorDetails onClose={() => setOpen(false)} />}
  </>
}

export function ErrorDetails({ id, onClose }: { id?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [info, setInfo] = useState<Info | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [warning, setWarning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    if (id) GetDiagnostic(id).then(value => { if (active) setInfo(value) }).catch(() => { if (active) setNotice(t('diagnostics.unavailable')) })
    GetDiagnosticSettings().then(value => { if (active) setStatus(value) }).catch(() => { if (active) setNotice(t('diagnostics.unavailable')) })
    return () => { active = false }
  }, [id, t])
  const act = async (action: () => Promise<unknown>, success = '') => {
    setBusy(true); setNotice('')
    try { await action(); setNotice(success) } catch { setNotice(t('diagnostics.actionFailed')) } finally { setBusy(false) }
  }
  const summary = info ? t('diagnostics.summary', { operation: info.operation, exitCode: info.exitCode, category: info.category }) : ''
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--text-pri) 45%, transparent)' , zIndex: 10000 }} />
      <Dialog.Content style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 560, maxWidth: 'calc(100vw - 32px)', maxHeight: '80vh', overflowY: 'auto', padding: 24, background: 'var(--bg-panel)', color: 'var(--text-pri)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 10001 }}>
        <Dialog.Title>{t(id ? 'diagnostics.title' : 'diagnostics.settings')}</Dialog.Title>
        <Dialog.Description>{t('diagnostics.policy')}</Dialog.Description>
        {id && (info ? <>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: "'JetBrains Mono', monospace" }}>{summary}</pre>
          <p>{t(`diagnostics.category.${info.category}`, { defaultValue: t('diagnostics.category.unknown') })}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button disabled={busy} onClick={() => act(() => navigator.clipboard.writeText(summary), t('diagnostics.copied'))}>{t('diagnostics.copySafe')}</Button>
            <Button disabled={busy || copiedRaw} onClick={() => setWarning(true)}>{t('diagnostics.copyRaw')}</Button>
          </div>
        </> : <p>{t('diagnostics.expired')}</p>)}
        {warning && <section role="alert" style={{ border: '1px solid var(--danger)', padding: 12, marginTop: 16 }}>
          <p>{t('diagnostics.warning')}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button disabled={busy} onClick={() => setWarning(false)}>{t('diagnostics.cancel')}</Button>
            <Button variant="danger" disabled={busy} onClick={() => act(async () => { if (id) { await CopyRawDiagnostic(id, true); setCopiedRaw(true); setWarning(false) } }, t('diagnostics.copied'))}>{t('diagnostics.confirmRaw')}</Button>
          </div>
        </section>}
        <section style={{ marginTop: 20 }}>
          <h3>{t('diagnostics.settings')}</h3>
          <label style={{ display: 'flex', gap: 8 }}>
            <input type="checkbox" checked={status?.enabled ?? false} disabled={!status || busy} onChange={event => { const enabled = event.target.checked; void act(async () => { await SetDiagnosticLogging(enabled); setStatus(await GetDiagnosticSettings()) }) }} />
            {t('diagnostics.enabled')}
          </label>
          {status?.reason && <p role="status">{t(`diagnostics.reason.${status.reason}`, { defaultValue: t('diagnostics.reason.protection') })}</p>}
        </section>
        {notice && <p role="status">{notice}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
          <Button disabled={busy || status?.reason === 'protection'} onClick={() => act(OpenDiagnosticFolder)}>{t('diagnostics.openFolder')}</Button>
          <Dialog.Close asChild><Button>{t('diagnostics.close')}</Button></Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
