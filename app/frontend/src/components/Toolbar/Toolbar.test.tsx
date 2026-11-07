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
import { CreateBranch, GetStatus, ListBranches } from '@wailsjs/go/main/App'
import { useGitStore } from '@/stores/gitStore'
import Toolbar from './Toolbar'
import CommandPalette from '@/components/shared/CommandPalette'

const status = { branch: 'feature/current-branch', ahead: 0, behind: 0, files: [], hasConflicts: false }

function renderToolbar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={queryClient}><Toolbar /></QueryClientProvider>)
  return queryClient
}

describe('current branch indicator', () => {
  beforeEach(() => {
    vi.mocked(GetStatus).mockReset().mockResolvedValue(status)
    useGitStore.setState({ activeView: 'changes', activeRepo: '/repo', recentRepos: [], helpDialogOpen: false })
  })

  afterEach(() => cleanup())

  it('shows the checked-out branch in Changes with the full name in its tooltip', async () => {
    const branch = `feature/${'a-long-branch-name-'.repeat(10)}`
    vi.mocked(GetStatus).mockResolvedValue({ ...status, branch })
    renderToolbar()

    const indicator = await screen.findByRole('status', { name: `Current branch: ${branch}` })
    expect(indicator).toHaveTextContent(branch)
    expect(indicator).toHaveAttribute('title', `Current branch: ${branch}`)
    expect(indicator.querySelector('span')).toHaveStyle({ textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
  })

  it('updates when repository status is refreshed after checkout or a worktree switch', async () => {
    const queryClient = renderToolbar()
    await screen.findByRole('status', { name: 'Current branch: feature/current-branch' })

    vi.mocked(GetStatus).mockResolvedValue({ ...status, branch: 'main' })
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['status'] }) })

    expect(await screen.findByRole('status', { name: 'Current branch: main' })).toHaveTextContent('main')
    expect(screen.queryByText(status.branch)).not.toBeInTheDocument()
  })

  it('explicitly labels detached HEAD instead of presenting HEAD as a branch', async () => {
    vi.mocked(GetStatus).mockResolvedValue({ ...status, branch: 'HEAD' })
    renderToolbar()

    expect(await screen.findByRole('status', { name: 'Detached HEAD' })).toHaveTextContent('Detached HEAD')
    expect(screen.queryByRole('status', { name: 'Current branch: HEAD' })).not.toBeInTheDocument()
  })

  it('does not display cached branch data when no repository is active', async () => {
    useGitStore.setState({ activeRepo: null })
    const queryClient = renderToolbar()
    await act(async () => { await queryClient.ensureQueryData({ queryKey: ['status'] }) })
    expect(queryClient.getQueryData(['status'])).toEqual(status)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not guess a branch while status is loading', () => {
    vi.mocked(GetStatus).mockReturnValue(new Promise(() => {}))
    renderToolbar()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('Detached HEAD')).not.toBeInTheDocument()
  })

  it('omits the indicator when the backend cannot determine the branch', async () => {
    vi.mocked(GetStatus).mockResolvedValue({ ...status, branch: '' })
    const queryClient = renderToolbar()
    await act(async () => { await queryClient.ensureQueryData({ queryKey: ['status'] }) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('repository creation actions', () => {
  beforeEach(() => {
    vi.mocked(GetStatus).mockReset().mockResolvedValue(status)
    vi.mocked(ListBranches).mockResolvedValue({ local: [{ name: 'main', remote: '', isHead: true, upstream: '', ahead: 0, behind: 0 }], remotes: [] })
    vi.mocked(CreateBranch).mockReset().mockResolvedValue(undefined)
    useGitStore.setState({ activeView: 'changes', activeRepo: '/repo', activeWorktree: null, recentRepos: [] })
  })
  afterEach(() => cleanup())

  it('opens the branch dialog from Changes and creates a branch', async () => {
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Branch' }))
    expect(await screen.findByRole('dialog', { name: 'New Branch' })).toBeInTheDocument()
    await screen.findByRole('option', { name: /main/ })
    fireEvent.change(screen.getByPlaceholderText('feature/my-feature'), { target: { value: 'feature/new' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Branch' }))
    await waitFor(() => expect(CreateBranch).toHaveBeenCalledWith('feature/new', 'main', true))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New Branch' })).not.toBeInTheDocument())
  })

  it.each([
    ['Stash', 'Create Stash'],
    ['Tag', 'Create Tag'],
  ])('opens the %s dialog from the toolbar', async (button, title) => {
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: button }))
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument()
  })

  it('disables creation actions without a repository', () => {
    useGitStore.setState({ activeRepo: null })
    renderToolbar()
    for (const name of ['Branch', 'Stash', 'Tag']) expect(screen.getByRole('button', { name })).toBeDisabled()
  })

  it('opens the branch dialog from the command palette', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={queryClient}><Toolbar /><CommandPalette /></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Command Palette (⌘K)' }))
    fireEvent.click(await screen.findByRole('button', { name: 'New Branch' }))
    expect(await screen.findByRole('dialog', { name: 'New Branch' })).toBeInTheDocument()
  })

  it('closes a creation dialog when the worktree changes', async () => {
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Branch' }))
    expect(await screen.findByRole('dialog', { name: 'New Branch' })).toBeInTheDocument()
    act(() => useGitStore.setState({ activeWorktree: '/other-worktree' }))
    expect(screen.queryByRole('dialog', { name: 'New Branch' })).not.toBeInTheDocument()
  })
})
