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
import { CreateTagDialog } from './CreateTagDialog'

const api = vi.hoisted(() => ({ GetCommits: vi.fn(), CreateTag: vi.fn() }))
vi.mock('@bindings/bough/app', () => api)

const head = 'a'.repeat(40)
const oldSelection = 'b'.repeat(40)

function openDialog() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  client.setQueryData(['commits', 1, false], [{ hash: oldSelection }])
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const onClose = vi.fn()
  render(<QueryClientProvider client={client}><CreateTagDialog onClose={onClose} /></QueryClientProvider>)
  return { invalidate, onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
  // No branch refs: this also represents a detached HEAD.
  api.GetCommits.mockResolvedValue([{ hash: head, refs: [] }])
  api.CreateTag.mockResolvedValue(undefined)
  useGitStore.setState({ activeRepo: '/repo', activeWorktree: '/repo/wt', selectedCommit: oldSelection, flash: null })
})
afterEach(() => cleanup())

describe('CreateTagDialog', () => {
  it('uses a fresh explicit HEAD rather than cached history or the selected commit', async () => {
    const { invalidate, onClose } = openDialog()
    expect(api.GetCommits).toHaveBeenCalledWith(1, false)
    expect(await screen.findByText(head)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tag name'), { target: { value: 'v1.0' } })
    // A later selection or HEAD change does not change the displayed target.
    act(() => useGitStore.setState({ selectedCommit: 'c'.repeat(40) }))
    api.GetCommits.mockResolvedValue([{ hash: 'd'.repeat(40) }])
    fireEvent.click(screen.getByRole('button', { name: 'Create Tag' }))
    await waitFor(() => expect(api.CreateTag).toHaveBeenCalledWith('v1.0', head))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tags'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['commits'] })
    expect(useGitStore.getState().activeWorktree).toBe('/repo/wt')
    expect(useGitStore.getState().flash).toMatchObject({ type: 'success' })
  })

  it('waits for HEAD and requires a name', async () => {
    let resolve!: (value: { hash: string }[]) => void
    api.GetCommits.mockReturnValue(new Promise(r => { resolve = r }))
    openDialog()
    expect(screen.getByText('Resolving HEAD…')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tag name'), { target: { value: 'v1' } })
    expect(screen.getByRole('button', { name: 'Create Tag' })).toBeDisabled()
    await act(async () => resolve([{ hash: head }]))
    await screen.findByText(head)
    fireEvent.change(screen.getByLabelText('Tag name'), { target: { value: '  ' } })
    expect(screen.getByRole('button', { name: 'Create Tag' })).toBeDisabled()
    expect(api.CreateTag).not.toHaveBeenCalled()
  })

  it.each([[], [{ hash: 'abc1234' }], [{ hash: 'HEAD' }]])('refuses an absent or non-full HEAD (%j)', async commits => {
    api.GetCommits.mockResolvedValue(commits)
    openDialog()
    fireEvent.change(screen.getByLabelText('Tag name'), { target: { value: 'v1' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not resolve HEAD')
    expect(screen.getByRole('button', { name: 'Create Tag' })).toBeDisabled()
    expect(api.CreateTag).not.toHaveBeenCalled()
  })

  it('displays HEAD read errors without attempting a write', async () => {
    api.GetCommits.mockRejectedValue(new Error('fatal: no commits yet'))
    openDialog()
    expect(await screen.findByRole('alert')).toHaveTextContent('no commits yet')
    expect(api.CreateTag).not.toHaveBeenCalled()
  })

  it('shows tag errors and permits retry', async () => {
    api.CreateTag.mockRejectedValueOnce('fatal: tag already exists')
    const { onClose } = openDialog()
    await screen.findByText(head)
    fireEvent.change(screen.getByLabelText('Tag name'), { target: { value: 'v1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Tag' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('tag already exists')
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Create Tag' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('blocks duplicate writes and dismissal while pending', async () => {
    let resolve!: () => void
    api.CreateTag.mockReturnValue(new Promise<void>(r => { resolve = r }))
    const { onClose } = openDialog()
    await screen.findByText(head)
    fireEvent.change(screen.getByLabelText('Tag name'), { target: { value: 'v1' } })
    const form = screen.getByRole('button', { name: 'Create Tag' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled())
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(api.CreateTag).toHaveBeenCalledOnce()
    await act(async () => resolve())
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('discards an in-flight HEAD read if the worktree is changed and switched back', async () => {
    let resolve!: (value: { hash: string }[]) => void
    api.GetCommits.mockReturnValue(new Promise(r => { resolve = r }))
    openDialog()
    act(() => {
      useGitStore.setState({ activeWorktree: '/other' })
      useGitStore.setState({ activeWorktree: '/repo/wt' })
    })
    await act(async () => resolve([{ hash: head }]))
    expect(screen.getByRole('alert')).toHaveTextContent('worktree changed')
    expect(screen.queryByText(head)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Tag' })).toBeDisabled()
    expect(api.CreateTag).not.toHaveBeenCalled()
  })
})
