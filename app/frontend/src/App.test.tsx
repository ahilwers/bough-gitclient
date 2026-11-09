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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateCommit, Fetch, PullForUI, Push } from '@bindings/gitmorrow/app'
import { Events } from '@wailsio/runtime'
import { useGitStore } from '@/stores/gitStore'
import App from './App'

// Keep the application shell and write controls real while isolating unrelated views.
vi.mock('@/components/Sidebar/Sidebar', () => ({ default: () => null }))
vi.mock('@/components/HistoryView/HistoryView', () => ({ default: () => <div>History view</div> }))
vi.mock('@/components/ChangesView/ChangesView', async () => {
  const { CommitBox } = await import('@/components/ChangesView/CommitBox')
  return { default: () => <CommitBox /> }
})
vi.mock('@/components/shared/CommandPalette', () => ({ default: () => null }))

describe('unrestricted application access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGitStore.setState({ activeView: 'history', activeRepo: '/repo', recentRepos: [], flash: null, showSidebar: true })
  })

  afterEach(() => cleanup())

  it('keeps the current branch visible when switching views with the sidebar hidden', async () => {
    useGitStore.setState({ showSidebar: false })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>)

    expect(await screen.findByRole('status', { name: 'Current branch: main' })).toHaveTextContent('main')
    fireEvent.click(screen.getByRole('button', { name: 'Changes' }))
    expect(screen.getByPlaceholderText('Describe your changes…')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Current branch: main' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByText('History view')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Current branch: main' })).toBeVisible()
  })

  it('starts without license APIs or revocation subscriptions and permits Git writes', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>)

    expect(screen.getByText('History view')).toBeInTheDocument()
    expect(vi.mocked(Events.On).mock.calls.map(([event]) => event)).not.toContain('license:revoked')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Fetch' }))
    await waitFor(() => expect(Fetch).toHaveBeenCalledWith(''))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pull' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Pull' }))
    await waitFor(() => expect(PullForUI).toHaveBeenCalledWith('/repo', 'main'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Push' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Push' }))
    await waitFor(() => expect(Push).toHaveBeenCalledWith('', '', false))

    fireEvent.click(screen.getByRole('button', { name: 'Changes' }))
    fireEvent.change(screen.getByPlaceholderText('Describe your changes…'), { target: { value: 'Test commit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }))
    await waitFor(() => expect(CreateCommit).toHaveBeenCalledWith('Test commit'))
  })
})
