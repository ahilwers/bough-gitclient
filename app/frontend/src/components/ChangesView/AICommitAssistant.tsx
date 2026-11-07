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
import { useEffect, useState } from 'react'
import { GenerateCommitMessage, GetAISettings, SaveAISettings } from '@wailsjs/go/main/App'
import type { main } from '@wailsjs/go/models'

// No credentials are kept in localStorage or returned by the Go settings API.
export function AICommitAssistant({ hasStaged, onApply }: { hasStaged: boolean; onApply: (message: string) => void }) {
  const [settings, setSettings] = useState<main.AISettings | null>(null)
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [removeKey, setRemoveKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => { GetAISettings().then(setSettings).catch(() => setError('Cannot load AI settings')) }, [])
  const inputStyle = { background: 'var(--bg-input)', color: 'var(--text-pri)', border: '1px solid var(--border)', borderRadius: 4, padding: 5, width: '100%' }
  async function save() {
    if (!settings) return
    setBusy(true); setError(''); setSaved(false)
    try {
      await SaveAISettings(settings, key, removeKey)
      setKey(''); setRemoveKey(false); setSettings(await GetAISettings()); setSaved(true)
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function generate() {
    setBusy(true); setError(''); setPreview('')
    try { setPreview(await GenerateCommitMessage()) } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  return <section aria-label="AI commit assistant" style={{ fontSize: 11, color: 'var(--text-sec)' }}>
    <div style={{ display: 'flex', gap: 8 }}>
      <Button variant="secondary" type="button" disabled={busy || !hasStaged || !settings?.hasAPIKey} onClick={generate}>{busy ? 'Working…' : 'Generate with AI'}</Button>
      <Button variant="secondary" type="button" disabled={busy} onClick={() => { setOpen(!open); setKey(''); setSaved(false) }}>AI settings</Button>
    </div>
    <p style={{ margin: '5px 0' }}>Only on Generate: staged diff (up to 512 KiB, including code and paths) is sent to your configured provider. Review for secrets first. Provider data policies and usage charges apply; larger diffs may cost more or exceed your model's context limit. Nothing is committed automatically.</p>
    {open && settings && <fieldset disabled={busy} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-panel2)', padding: '10px 12px 12px', display: 'grid', gap: 10, margin: '10px 0', minWidth: 0 }}>
      <legend>AI commit settings · Bring your own key</legend>
      <label>Provider<select aria-label="AI provider" style={inputStyle} value={settings.provider} onChange={e => {
        const provider = e.target.value
        setSettings({ ...settings, provider, baseURL: provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1', model: provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini', hasAPIKey: false })
      }}><option value="openrouter">OpenRouter</option><option value="openai-compatible">OpenAI compatible</option></select></label>
      <label>API base URL<input style={inputStyle} value={settings.baseURL} onChange={e => setSettings({ ...settings, baseURL: e.target.value, hasAPIKey: false })} /></label>
      <label>Model ID<input style={inputStyle} value={settings.model} onChange={e => setSettings({ ...settings, model: e.target.value })} /></label>
      <label>API key {settings.hasAPIKey ? '(stored securely; blank keeps existing)' : '(required)'}<input type="password" autoComplete="off" style={inputStyle} value={key} onChange={e => setKey(e.target.value)} /></label>
      <label><input type="checkbox" checked={removeKey} onChange={e => setRemoveKey(e.target.checked)} />Remove stored key for this endpoint</label>
      <span>Keys stay in the OS credential store, never in repository files. Save settings before generating.</span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
        {saved && <span role="status">Settings saved</span>}
        <Button variant="primary" type="button" onClick={save}>Save AI settings</Button>
      </div>
    </fieldset>}
    {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
    {preview && <div style={{ border: '1px solid var(--border)', padding: 8 }}>
      <strong>Suggested message — review before applying</strong>
      <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto', userSelect: 'text' }}>{preview}</pre>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <Button variant="primary" type="button" onClick={() => { onApply(preview); setPreview('') }}>Replace input with suggestion</Button>
        <Button variant="secondary" type="button" onClick={() => setPreview('')}>Dismiss</Button>
      </div>
    </div>}
  </section>
}
