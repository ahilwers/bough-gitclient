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
import { GetPushInfo, GetStatus, Push } from '@bindings/bough/app'
import { useGitStore } from '@/stores/gitStore'
import i18n from '@/i18n'
import Toolbar from './Toolbar'

const status = { branch: 'main', ahead: 3, behind: 0, files: [], hasConflicts: false }
function renderToolbar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}><Toolbar /></QueryClientProvider>)
  return client
}
const pushButton = () => screen.getByRole('button', { name: 'Push' })
const badge = () => pushButton().querySelector('.toolbar-icon-badge')

beforeEach(() => {
  vi.mocked(GetStatus).mockReset().mockResolvedValue(status)
  vi.mocked(GetPushInfo).mockReset().mockResolvedValue({ repoPath: '/repo', branch: 'main', upstream: 'origin/main', remotes: ['origin'] })
  vi.mocked(Push).mockReset().mockResolvedValue(undefined)
  useGitStore.setState({ activeRepo: '/repo', activeWorktree: null, recentRepos: [], loadingOperation: null })
})
afterEach(async () => { cleanup(); await i18n.changeLanguage('en') })

describe('push commit badge', () => {
  it('shows unpushed commits with an accessible description and tooltip', async () => {
    renderToolbar()
    await waitFor(() => expect(badge()).toHaveTextContent('3'))
    expect(pushButton()).toHaveAccessibleDescription('Push — 3 unpushed commits (compared with upstream)')
    expect(pushButton()).toHaveAttribute('title', 'Push — 3 unpushed commits (compared with upstream)')
  })

  it('caps the visible badge but preserves the exact count in the tooltip', async () => {
    vi.mocked(GetStatus).mockResolvedValue({ ...status, ahead: 123 })
    renderToolbar()
    await waitFor(() => expect(badge()).toHaveTextContent('99+'))
    expect(pushButton()).toHaveAttribute('title', 'Push — 123 unpushed commits (compared with upstream)')
  })

  it.each([1, 2])('localizes the description for %i commits', async count => {
    await i18n.changeLanguage('de')
    vi.mocked(GetStatus).mockResolvedValue({ ...status, ahead: count })
    renderToolbar()
    await waitFor(() => expect(badge()).toHaveTextContent(String(count)))
    expect(pushButton()).toHaveAccessibleDescription(count === 1
      ? 'Push — 1 noch nicht gepushter Commit (gegenüber dem Upstream)'
      : 'Push — 2 noch nicht gepushte Commits (gegenüber dem Upstream)')
  })

  it('does not count uncommitted files or behind-only commits', async () => {
    vi.mocked(GetStatus).mockResolvedValue({ ...status, ahead: 0, behind: 2, files: [{ path: 'file', oldPath: '', staged: 'M', unstaged: 'M', added: 1, deleted: 0 }] })
    const client = renderToolbar()
    await act(async () => { await client.ensureQueryData({ queryKey: ['status'] }) })
    expect(badge()).toBeNull()
    expect(pushButton()).toBeEnabled()
    expect(pushButton()).toHaveAttribute('title', 'Push')
  })

  it('does not show a badge while status is loading', () => {
    vi.mocked(GetStatus).mockReturnValue(new Promise(() => {}))
    renderToolbar()
    expect(badge()).toBeNull()
  })

  it.each([null, 'HEAD', ''])('does not show a count without an active branch (%s)', async branch => {
    if (branch === null) useGitStore.setState({ activeRepo: null })
    else vi.mocked(GetStatus).mockResolvedValue({ ...status, branch })
    const client = renderToolbar()
    await act(async () => { await client.ensureQueryData({ queryKey: ['status'] }) })
    expect(badge()).toBeNull()
  })

  it('updates after a refreshed checkout or commit', async () => {
    const client = renderToolbar()
    await waitFor(() => expect(badge()).toHaveTextContent('3'))
    vi.mocked(GetStatus).mockResolvedValue({ ...status, branch: 'topic', ahead: 1 })
    await act(async () => { await client.invalidateQueries({ queryKey: ['status'] }) })
    await waitFor(() => expect(badge()).toHaveTextContent('1'))
  })

  it('keeps the count while pushing and clears it after successful status refresh', async () => {
    let resolve!: () => void
    vi.mocked(Push).mockReturnValue(new Promise<void>(done => { resolve = done }))
    renderToolbar()
    await waitFor(() => expect(badge()).toHaveTextContent('3'))
    fireEvent.click(pushButton())
    await waitFor(() => expect(Push).toHaveBeenCalled())
    expect(pushButton()).toBeDisabled()
    expect(badge()).toHaveTextContent('3')
    vi.mocked(GetStatus).mockResolvedValue({ ...status, ahead: 0 })
    await act(async () => resolve())
    await waitFor(() => expect(badge()).toBeNull())
  })

  it('preserves the badge after a failed push', async () => {
    vi.mocked(Push).mockRejectedValue(new Error('push failed'))
    renderToolbar()
    await waitFor(() => expect(badge()).toHaveTextContent('3'))
    fireEvent.click(pushButton())
    await waitFor(() => expect(Push).toHaveBeenCalled())
    await waitFor(() => expect(pushButton()).toBeEnabled())
    expect(badge()).toHaveTextContent('3')
  })
})
