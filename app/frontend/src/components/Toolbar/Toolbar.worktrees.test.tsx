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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GetStatus, ListWorktrees, StageFile, SwitchWorktree } from '@bindings/gitmorrow/app'
import { useGitStore } from '@/stores/gitStore'
import i18n from '@/i18n'
import Toolbar from './Toolbar'
import Sidebar from '@/components/Sidebar/Sidebar'
import ChangesView from '@/components/ChangesView/ChangesView'

const main = '/projects/client'
const linked = '/projects/client-feature'
const worktrees = [
  { path: main, branch: 'main', head: 'abc1234', isMain: true, isDirty: false },
  { path: linked, branch: 'feature', head: 'def1234', isMain: false, isDirty: true },
]

function renderToolbar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}><Toolbar /></QueryClientProvider>)
  return client
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ListWorktrees).mockResolvedValue(worktrees)
  vi.mocked(SwitchWorktree).mockResolvedValue(undefined)
  vi.mocked(GetStatus).mockImplementation(async () => ({
    branch: (useGitStore.getState().activeWorktree ?? useGitStore.getState().activeRepo) === linked ? 'feature' : 'main',
    ahead: 0, behind: 0, files: [], hasConflicts: false,
  }))
  useGitStore.setState({ activeRepo: linked, activeWorktree: null, activeView: 'history', showSidebar: false, recentRepos: [], flash: null })
})
afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('en')
})

describe('worktree selector', () => {
  it('keeps the History sidebar and toolbar in sync, including the initially opened linked worktree', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={client}><Toolbar /><Sidebar /></QueryClientProvider>)
    const rows = await screen.findAllByTestId('worktree-item')
    expect(rows[1]).toHaveStyle({ fontWeight: '600' })
    expect(rows[0]).toHaveStyle({ fontWeight: '400' })
    fireEvent.click(rows[0])
    expect(await screen.findByRole('button', { name: `Current worktree: ${main}` })).toBeVisible()
    await waitFor(() => expect(rows[0]).toHaveStyle({ fontWeight: '600' }))
    expect(rows[1]).toHaveStyle({ fontWeight: '400' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: `Current worktree: ${main}` }))
    await user.click(await screen.findByRole('menuitemradio', { name: linked }))
    await waitFor(() => expect(rows[1]).toHaveStyle({ fontWeight: '600' }))
    expect(rows[0]).toHaveStyle({ fontWeight: '400' })
  })

  it('clears the selected Changes file after switching to a worktree with the same filename', async () => {
    vi.mocked(GetStatus).mockResolvedValue({ branch: 'main', ahead: 0, behind: 0, hasConflicts: false, files: [{ path: 'shared.txt', oldPath: '', staged: '', unstaged: 'M', added: 0, deleted: 0 }] })
    const user = userEvent.setup()
    useGitStore.setState({ activeView: 'changes' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={client}><Toolbar /><ChangesView /></QueryClientProvider>)
    fireEvent.click(await screen.findByText('shared.txt'))
    expect(screen.queryByText('Select a file to view changes')).not.toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Describe your changes…'), { target: { value: 'Draft message' } })
    await user.click(screen.getByRole('button', { name: `Current worktree: ${linked}` }))
    await user.click(await screen.findByRole('menuitemradio', { name: main }))
    expect(await screen.findByRole('button', { name: `Current worktree: ${main}` })).toBeVisible()
    expect(await screen.findByText('Select a file to view changes')).toBeVisible()
    expect(screen.getByPlaceholderText('Describe your changes…')).toHaveValue('Draft message')
  })

  it('hides old status and disables commit until the new worktree status loads', async () => {
    const oldStatus = { branch: 'feature', ahead: 0, behind: 0, hasConflicts: false, files: [{ path: 'old.txt', oldPath: '', staged: 'M', unstaged: 'M', added: 0, deleted: 0 }] }
    let resolveStatus!: (value: typeof oldStatus) => void
    vi.mocked(GetStatus).mockReset().mockResolvedValueOnce(oldStatus).mockImplementation(() => new Promise(resolve => { resolveStatus = resolve }))
    useGitStore.setState({ activeView: 'changes' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={client}><Toolbar /><ChangesView /></QueryClientProvider>)
    expect((await screen.findAllByText('old.txt')).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByPlaceholderText('Describe your changes…'), { target: { value: 'Draft' } })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: `Current worktree: ${linked}` }))
    await user.click(await screen.findByRole('menuitemradio', { name: main }))
    await screen.findByRole('button', { name: `Current worktree: ${main}` })
    expect(screen.queryAllByText('old.txt')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Commit' })).toBeDisabled()
    await act(async () => { resolveStatus({ ...oldStatus, branch: 'main', files: [{ ...oldStatus.files[0], path: 'new.txt' }] }) })
    expect((await screen.findAllByText('new.txt')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Commit' })).toBeEnabled()
  })

  it('clears selected file and its shortcuts while a worktree switch is pending', async () => {
    vi.mocked(GetStatus).mockResolvedValue({ branch: 'feature', ahead: 0, behind: 0, hasConflicts: false, files: [{ path: 'old.txt', oldPath: '', staged: '', unstaged: 'M', added: 0, deleted: 0 }] })
    vi.mocked(SwitchWorktree).mockReturnValue(new Promise(() => {}))
    useGitStore.setState({ activeView: 'changes' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={client}><Toolbar /><ChangesView /></QueryClientProvider>)
    fireEvent.click(await screen.findByText('old.txt'))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: `Current worktree: ${linked}` }))
    await user.click(await screen.findByRole('menuitemradio', { name: main }))
    expect(await screen.findByText('Select a file to view changes')).toBeVisible()
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    expect(StageFile).not.toHaveBeenCalled()
  })

  it('does not surface a status refetched while a worktree switch is pending', async () => {
    // The backend keeps answering with the previous worktree's status until the
    // switch completes — exactly what a slow switch looks like.
    vi.mocked(GetStatus).mockResolvedValue({ branch: 'feature', ahead: 0, behind: 0, hasConflicts: false, files: [{ path: 'old.txt', oldPath: '', staged: 'M', unstaged: 'M', added: 0, deleted: 0 }] })
    vi.mocked(SwitchWorktree).mockReturnValue(new Promise(() => {}))
    useGitStore.setState({ activeView: 'changes' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={client}><Toolbar /><ChangesView /></QueryClientProvider>)
    expect((await screen.findAllByText('old.txt')).length).toBeGreaterThan(0)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: `Current worktree: ${linked}` }))
    await user.click(await screen.findByRole('menuitemradio', { name: main }))

    // The status query polls every few seconds; a refetch resolving while the
    // switch is in flight must not put the previous worktree's files back on
    // screen, even though the response belongs to the old worktree.
    await act(async () => { await client.refetchQueries({ queryKey: ['status'] }) })
    await waitFor(() => {
      const query = client.getQueryCache().findAll({ queryKey: ['status'] })[0]
      expect((query?.state.data as { files?: unknown[] } | undefined)?.files?.length).toBeGreaterThan(0)
    })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(screen.queryAllByText('old.txt')).toHaveLength(0)
  })

  it('does not offer worktrees from the previous repository while the new list loads', async () => {
    const user = userEvent.setup()
    let resolveList!: (value: typeof worktrees) => void
    vi.mocked(ListWorktrees).mockResolvedValueOnce(worktrees).mockImplementationOnce(() => new Promise(resolve => { resolveList = resolve }))
    const client = renderToolbar()
    await user.click(screen.getByRole('button', { name: `Current worktree: ${linked}` }))
    expect(await screen.findByRole('menuitemradio', { name: main })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    act(() => { useGitStore.getState().setActiveRepo('/other') })
    act(() => { void client.invalidateQueries({ queryKey: ['worktrees'] }) })
    await user.click(screen.getByRole('button', { name: 'Current worktree: /other' }))
    expect(screen.queryByRole('menuitemradio', { name: main })).not.toBeInTheDocument()
    expect(screen.getByText('Loading worktrees…')).toBeVisible()
    await act(async () => { resolveList([{ ...worktrees[0], path: '/other' }]) })
    expect(await screen.findByRole('menuitemradio', { name: '/other' })).toBeInTheDocument()
  })

  it('keeps the current worktree when switching fails', async () => {
    vi.mocked(SwitchWorktree).mockRejectedValue(new Error('switch failed'))
    const user = userEvent.setup()
    renderToolbar()
    await user.click(screen.getByRole('button', { name: `Current worktree: ${linked}` }))
    await user.click(await screen.findByRole('menuitemradio', { name: main }))
    await waitFor(() => expect(useGitStore.getState().flash?.message).toBe('switch failed'))
    expect(useGitStore.getState().activeWorktree).toBeNull()
    expect(screen.getByRole('button', { name: `Current worktree: ${linked}` })).toBeVisible()
  })

  it('hides the selector when no repository is open', () => {
    useGitStore.setState({ activeRepo: null, activeWorktree: null })
    renderToolbar()
    expect(screen.queryByRole('button', { name: /Current worktree:/ })).not.toBeInTheDocument()
  })

  it('labels the current worktree in German', async () => {
    await i18n.changeLanguage('de')
    const user = userEvent.setup()
    renderToolbar()
    expect(screen.getByRole('button', { name: `Aktueller Worktree: ${linked}` })).toBeVisible()
    await user.click(screen.getByRole('button', { name: `Aktueller Worktree: ${linked}` }))
    expect(await screen.findByRole('menuitemradio', { name: main })).toBeInTheDocument()
  })

  it('shows the current worktree and switches it in Changes and History with the sidebar hidden', async () => {
    const user = userEvent.setup()
    renderToolbar()
    expect(screen.getByRole('button', { name: `Current worktree: ${linked}` })).toHaveTextContent('client-feature')
    expect(await screen.findByRole('status', { name: 'Current branch: feature' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Changes' }))
    await user.click(screen.getByRole('button', { name: `Current worktree: ${linked}` }))
    expect(await screen.findByRole('menuitemradio', { name: linked })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('menuitemradio', { name: main }))
    await waitFor(() => expect(SwitchWorktree).toHaveBeenCalledWith(main))
    expect(await screen.findByRole('button', { name: `Current worktree: ${main}` })).toBeVisible()
    expect(await screen.findByRole('status', { name: 'Current branch: main' })).toBeVisible()
    expect(useGitStore.getState().activeRepo).toBe(linked)

    await user.click(screen.getByRole('button', { name: 'History' }))
    await user.click(screen.getByRole('button', { name: `Current worktree: ${main}` }))
    expect(await screen.findByRole('menuitemradio', { name: main })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('menuitemradio', { name: linked }))
    await waitFor(() => expect(useGitStore.getState().activeWorktree).toBe(linked))
    expect(await screen.findByRole('button', { name: `Current worktree: ${linked}` })).toBeVisible()
  })
})
