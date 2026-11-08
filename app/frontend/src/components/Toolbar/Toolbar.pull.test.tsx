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

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GetStatus, PullForUI, ResolvePull } from '@bindings/bough/app'
import { useGitStore } from '@/stores/gitStore'
import Toolbar from './Toolbar'
import i18n from '@/i18n'

const snapshot = { repo: '/repo', branch: 'main', head: 'abc', upstream: 'origin/main', target: 'def', remote: 'origin', mergeRef: 'refs/heads/main' }
const status = { branch: 'main', ahead: 1, behind: 1, files: [], hasConflicts: false }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(<QueryClientProvider client={client}><Toolbar /></QueryClientProvider>)
  return { client, invalidate }
}
async function pull() {
  await screen.findByRole('status', { name: 'Current branch: main' })
  fireEvent.click(screen.getByRole('button', { name: 'Pull' }))
}
beforeEach(() => {
  vi.mocked(GetStatus).mockReset().mockResolvedValue(status)
  vi.mocked(PullForUI).mockReset().mockResolvedValue({ outcome: 'choice', snapshot })
  vi.mocked(ResolvePull).mockReset().mockResolvedValue({ outcome: 'success' })
  useGitStore.setState({ activeRepo: '/repo', activeView: 'history', recentRepos: [], helpDialogOpen: false, flash: null })
})
afterEach(async () => { cleanup(); await i18n.changeLanguage('en') })
it('explains the one-shot choice and rewritten commit IDs in German', async () => {
  await i18n.changeLanguage('de')
  setup()
  await screen.findByRole('status')
  fireEvent.click(screen.getByRole('button', { name: 'Pull' }))
  await screen.findByRole('dialog')
  expect(screen.getByText(/Dabei werden lokale Commits umgeschrieben/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus()
})
it('focuses Cancel, explains rewriting and cancels without integration', async () => {
  setup(); await pull()
  await screen.findByRole('dialog')
  expect(screen.getByText(/This rewrites local commits/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  for (const name of ['Cancel', 'Merge', 'Rebase']) {
    expect(screen.getByRole('button', { name })).toHaveClass('action-button')
  }
  // Neither integration strategy is presented as an implicit recommendation.
  expect(screen.getByRole('button', { name: 'Merge' })).not.toHaveClass('action-button--primary')
  expect(screen.getByRole('button', { name: 'Rebase' })).not.toHaveClass('action-button--primary')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(ResolvePull).not.toHaveBeenCalled()
})
for (const strategy of ['Merge', 'Rebase']) it(`runs one-shot ${strategy} and refreshes`, async () => {
  const { invalidate } = setup(); await pull(); await screen.findByRole('dialog')
  fireEvent.click(screen.getByRole('button', { name: strategy }))
  await waitFor(() => expect(ResolvePull).toHaveBeenCalledWith(snapshot, strategy.toLowerCase()))
  await waitFor(() => expect(useGitStore.getState().flash?.message).toBe('Pulled successfully'))
  expect(invalidate).toHaveBeenCalled()
})
it('routes conflicts to Changes without success and refreshes', async () => {
  vi.mocked(ResolvePull).mockResolvedValue({ outcome: 'conflict', detail: 'conflicts' })
  const { invalidate } = setup(); await pull(); await screen.findByRole('dialog')
  fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
  await waitFor(() => expect(useGitStore.getState().activeView).toBe('changes'))
  expect(useGitStore.getState().flash?.message).toMatch(/Pull stopped/)
  expect(invalidate).toHaveBeenCalled()
})
it('preserves authentication errors without prompting for a strategy', async () => {
  vi.mocked(PullForUI).mockRejectedValue(new Error('Authentication failed'))
  setup(); await pull()
  await waitFor(() => expect(useGitStore.getState().flash?.message).toMatch(/Authentication failed/))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('reports explicit strategy errors, not success', async () => {
  vi.mocked(ResolvePull).mockRejectedValue(new Error('branch changed; pull again'))
  setup(); await pull(); await screen.findByRole('dialog')
  fireEvent.click(screen.getByRole('button', { name: 'Rebase' }))
  await waitFor(() => expect(useGitStore.getState().flash?.message).toMatch(/branch changed/))
})
it('ignores late results after repository switch', async () => {
  let resolve!: (value: { outcome: string; snapshot: typeof snapshot }) => void
  vi.mocked(PullForUI).mockReturnValue(new Promise(r => { resolve = r }))
  setup(); await pull()
  act(() => useGitStore.setState({ activeRepo: '/other' }))
  await act(async () => resolve({ outcome: 'choice', snapshot }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(useGitStore.getState().flash).toBeNull()
})
it('closes an open decision when branch changes', async () => {
  const { client } = setup(); await pull(); await screen.findByRole('dialog')
  act(() => client.setQueryData(['status'], { ...status, branch: 'other' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(ResolvePull).not.toHaveBeenCalled()
})
it('normal configured pull succeeds without dialog', async () => {
  vi.mocked(PullForUI).mockResolvedValue({ outcome: 'success' })
  setup(); await pull()
  await waitFor(() => expect(useGitStore.getState().flash?.message).toBe('Pulled successfully'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
