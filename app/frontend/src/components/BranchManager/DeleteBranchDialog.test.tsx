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
import { useGitStore } from '@/stores/gitStore'
import { DeleteBranchDialog } from './DeleteBranchDialog'
import i18n from '@/i18n'

const api = vi.hoisted(() => ({ PrepareBranchDeletion: vi.fn(), DeleteBranch: vi.fn() }))
vi.mock('@wailsjs/go/main/App', () => api)
const local = { name: 'topic', remote: '', isRemote: false, repo: '/repo', worktree: '/repo' }
const remote = { ...local, name: 'origin/topic', remote: 'origin', isRemote: true }
const snapshot = (target = local) => ({ repoPath: '/repo', name: target.name, remote: target.remote, ref: 'refs/heads/topic', oid: 'a'.repeat(40), destination: target.isRemote ? 'origin (example.com)' : 'Local branch', configFingerprint: '' })
function open(target = local) {
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const onClose = vi.fn()
  const view = render(<QueryClientProvider client={client}><DeleteBranchDialog target={target} onClose={onClose} /></QueryClientProvider>)
  return { onClose, invalidate, ...view }
}
beforeEach(() => {
  vi.clearAllMocks()
  useGitStore.setState({ activeRepo: '/repo', activeWorktree: '/repo', flash: null })
  api.PrepareBranchDeletion.mockResolvedValue(snapshot())
  api.DeleteBranch.mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); void i18n.changeLanguage('en') })

describe('branch deletion confirmation', () => {
  it('shows the remote warning and actions in German', async () => {
    await i18n.changeLanguage('de')
    api.PrepareBranchDeletion.mockResolvedValue(snapshot(remote))
    open(remote)
    expect(await screen.findByText(/betrifft auch andere Benutzer/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus()
    expect(await screen.findByText(/Server-Ref: refs\/heads\/topic/)).toBeInTheDocument()
  })
  it('prepares and deletes only the confirmed local snapshot, invalidating affected queries', async () => {
    const { invalidate, onClose } = open()
    expect(api.PrepareBranchDeletion).toHaveBeenCalledWith('topic', '')
    expect(await screen.findByText(/not the branch on the server/)).toBeInTheDocument()
    await screen.findByText(/refs\/heads\/topic/)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Branch' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(api.DeleteBranch).toHaveBeenCalledWith(snapshot())
    for (const key of ['branches', 'commits', 'status', 'worktrees']) expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] })
  })
  it('shows the remote server ref, destination and OID before confirmation', async () => {
    api.PrepareBranchDeletion.mockResolvedValue(snapshot(remote))
    open(remote)
    expect(api.PrepareBranchDeletion).toHaveBeenCalledWith('origin/topic', 'origin')
    expect(await screen.findByText(/affects other users/)).toBeInTheDocument()
    expect(await screen.findByText(/Server ref: refs\/heads\/topic/)).toBeInTheDocument()
    expect(screen.getByText(/origin \(example.com\)/)).toBeInTheDocument()
    expect(screen.getByText(/OID: aaaa/)).toBeInTheDocument()
  })
  it('blocks confirmation while loading and allows cancellation', () => {
    api.PrepareBranchDeletion.mockReturnValue(new Promise(() => {}))
    const { onClose } = open()
    expect(screen.getByRole('button', { name: 'Delete Branch' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(api.DeleteBranch).not.toHaveBeenCalled()
  })
  it('rejects a missing remote without preparing', async () => {
    open({ ...remote, remote: '' })
    expect(await screen.findByRole('alert')).toHaveTextContent('known remote')
    expect(api.PrepareBranchDeletion).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete Branch' })).toBeDisabled()
  })
  it.each([{ name: 'other', remote: 'origin' }, { name: 'origin/topic', remote: '' }])('rejects mismatched snapshots %j', async fields => {
    api.PrepareBranchDeletion.mockResolvedValue({ ...snapshot(remote), ...fields })
    open(remote)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Branch' })).toBeDisabled()
  })
  it('shows prepare and delete errors', async () => {
    api.PrepareBranchDeletion.mockRejectedValueOnce('fatal: no remote')
    const view = open(remote)
    expect(await screen.findByRole('alert')).toHaveTextContent('no remote')
    view.unmount()
    api.PrepareBranchDeletion.mockResolvedValue(snapshot())
    api.DeleteBranch.mockRejectedValueOnce('fatal: not merged')
    open()
    await screen.findByText(/refs\/heads\/topic/)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Branch' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not merged')
  })
  it('closes on context switch and ignores late prepare results', async () => {
    let resolve!: (value: ReturnType<typeof snapshot>) => void
    api.PrepareBranchDeletion.mockReturnValue(new Promise(r => { resolve = r }))
    const { onClose } = open()
    act(() => { useGitStore.setState({ activeWorktree: '/other' }); useGitStore.setState({ activeWorktree: '/repo' }) })
    expect(onClose).toHaveBeenCalled()
    await act(async () => resolve(snapshot()))
    expect(screen.getByRole('button', { name: 'Delete Branch' })).toBeDisabled()
  })
  it('blocks duplicate submissions while deleting', async () => {
    api.DeleteBranch.mockReturnValue(new Promise(() => {}))
    open()
    await screen.findByText(/refs\/heads\/topic/)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Branch' }))
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(api.DeleteBranch).toHaveBeenCalledOnce()
  })
})
