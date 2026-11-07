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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GetPushInfo, Push, PushWithUpstream } from '@wailsjs/go/main/App'
import { useGitStore } from '@/stores/gitStore'
import Toolbar from './Toolbar'
import i18n from '@/i18n'

function renderToolbar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(<QueryClientProvider client={client}><Toolbar /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Push' }))
  return invalidate
}

const untracked = { repoPath: '/repo', branch: 'feature/new', upstream: '', remotes: ['origin'] }

describe('push upstream confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGitStore.setState({ activeRepo: '/repo', recentRepos: [], flash: null, loadingOperation: null })
    vi.mocked(GetPushInfo).mockResolvedValue(untracked)
    vi.mocked(PushWithUpstream).mockResolvedValue(undefined)
  })
  afterEach(async () => {
    cleanup()
    await i18n.changeLanguage('en')
  })

  it('renders German dialog text and accessible controls while preserving the selected upstream', async () => {
    await i18n.changeLanguage('de')
    vi.mocked(GetPushInfo).mockResolvedValue({ ...untracked, remotes: ['origin', 'fork'] })
    renderToolbar()
    const dialog = await screen.findByRole('dialog', { name: 'Upstream-Branch erstellen?' })
    expect(dialog).toHaveTextContent('Branch feature/new hat keinen Upstream.')
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus()
    const confirm = screen.getByRole('button', { name: 'Upstream erstellen & pushen' })
    expect(confirm).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Remote auswählen…' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Remote-Repository' }), { target: { value: 'fork' } })
    expect(screen.getByText('Upstream-Branch: fork/feature/new')).toBeInTheDocument()
    expect(PushWithUpstream).not.toHaveBeenCalled()
    fireEvent.click(confirm)
    await waitFor(() => expect(PushWithUpstream).toHaveBeenCalledWith('/repo', 'fork', 'feature/new'))
  })

  it('renders missing-remote guidance in German without allowing a push', async () => {
    await i18n.changeLanguage('de')
    vi.mocked(GetPushInfo).mockResolvedValue({ ...untracked, remotes: [] })
    renderToolbar()
    expect(await screen.findByRole('dialog')).toHaveTextContent('Keine Remotes konfiguriert.')
    expect(screen.getByRole('button', { name: 'Upstream erstellen & pushen' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(PushWithUpstream).not.toHaveBeenCalled()
  })

  it('does not push until explicit confirmation and refreshes after success', async () => {
    const invalidate = renderToolbar()
    expect(await screen.findByRole('dialog')).toHaveTextContent('feature/new')
    expect(Push).not.toHaveBeenCalled()
    expect(PushWithUpstream).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Create Upstream & Push' }))
    await waitFor(() => expect(PushWithUpstream).toHaveBeenCalledWith('/repo', 'origin', 'feature/new'))
    await waitFor(() => expect(useGitStore.getState().flash?.message).toBe('Pushed successfully'))
    expect(invalidate).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each(['Cancel', 'Escape', 'outside'])('does not write on %s dismissal', async method => {
    renderToolbar()
    const dialog = await screen.findByRole('dialog')
    if (method === 'Cancel') fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    else if (method === 'Escape') fireEvent.keyDown(dialog, { key: 'Escape' })
    else fireEvent.pointerDown(dialog.previousElementSibling!)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(Push).not.toHaveBeenCalled()
    expect(PushWithUpstream).not.toHaveBeenCalled()
  })

  it('requires a choice with multiple remotes and uses the selected remote', async () => {
    vi.mocked(GetPushInfo).mockResolvedValue({ ...untracked, remotes: ['origin', 'fork'] })
    renderToolbar()
    const confirm = await screen.findByRole('button', { name: 'Create Upstream & Push' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByRole('combobox', { name: 'Remote' }), { target: { value: 'fork' } })
    expect(screen.getByText('Upstream: fork/feature/new')).toBeInTheDocument()
    fireEvent.click(confirm)
    await waitFor(() => expect(PushWithUpstream).toHaveBeenCalledWith('/repo', 'fork', 'feature/new'))
  })

  it('explains missing remotes without allowing a push', async () => {
    vi.mocked(GetPushInfo).mockResolvedValue({ ...untracked, remotes: [] })
    renderToolbar()
    expect(await screen.findByRole('dialog')).toHaveTextContent('No remotes configured')
    expect(screen.getByRole('button', { name: 'Create Upstream & Push' })).toBeDisabled()
    expect(Push).not.toHaveBeenCalled()
    expect(PushWithUpstream).not.toHaveBeenCalled()
  })

  it('preserves normal push for a tracked branch', async () => {
    vi.mocked(GetPushInfo).mockResolvedValue({ ...untracked, upstream: 'origin/feature/new' })
    renderToolbar()
    await waitFor(() => expect(Push).toHaveBeenCalledWith('', '', false))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(PushWithUpstream).not.toHaveBeenCalled()
  })

  it('reports detached HEAD and other preflight failures without writing', async () => {
    vi.mocked(GetPushInfo).mockRejectedValueOnce(new Error('cannot push from detached HEAD'))
    renderToolbar()
    await waitFor(() => expect(useGitStore.getState().flash?.message).toContain('detached HEAD'))
    expect(Push).not.toHaveBeenCalled()
    expect(PushWithUpstream).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('preserves authentication errors and clears loading after a failed confirmed push', async () => {
    vi.mocked(PushWithUpstream).mockRejectedValueOnce(new Error('git: authentication failed'))
    renderToolbar()
    fireEvent.click(await screen.findByRole('button', { name: 'Create Upstream & Push' }))
    await waitFor(() => expect(useGitStore.getState().flash?.message).toContain('authentication failed'))
    expect(useGitStore.getState().loadingOperation).toBeNull()
    expect(screen.getByRole('button', { name: 'Push' })).toBeEnabled()
    expect(Push).not.toHaveBeenCalled()
  })

  it('dismisses confirmation when the active repository changes', async () => {
    renderToolbar()
    await screen.findByRole('dialog')
    act(() => useGitStore.setState({ activeRepo: '/other' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(PushWithUpstream).not.toHaveBeenCalled()
  })

  it('discards a preflight result for a repository that is no longer active', async () => {
    let resolve!: (value: typeof untracked) => void
    vi.mocked(GetPushInfo).mockReturnValueOnce(new Promise(done => { resolve = done }))
    renderToolbar()
    act(() => useGitStore.setState({ activeRepo: '/other' }))
    await act(async () => { resolve(untracked) })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(Push).not.toHaveBeenCalled()
    expect(PushWithUpstream).not.toHaveBeenCalled()
  })
})
