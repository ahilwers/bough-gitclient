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
import i18n from '@/i18n'
import { CreateStashDialog } from './CreateStashDialog'

const api = vi.hoisted(() => ({ CreateStash: vi.fn() }))
vi.mock('@bindings/bough/app', () => api)

function openDialog() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const onClose = vi.fn()
  render(<QueryClientProvider client={client}><CreateStashDialog onClose={onClose} /></QueryClientProvider>)
  return { client, invalidate, onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.CreateStash.mockResolvedValue(undefined)
  useGitStore.setState({ activeRepo: '/repo', activeWorktree: '/repo/wt', flash: null })
})
afterEach(async () => { cleanup(); await i18n.changeLanguage('en') })

describe('CreateStashDialog', () => {
  it('excludes untracked by default, permits an empty message, and invalidates changed data', async () => {
    const { client, invalidate, onClose } = openDialog()
    const dispatch = vi.spyOn(window, 'dispatchEvent')
    client.setQueryData(['stashDiff', 0], [{ path: 'old' }])
    expect(screen.getByText(/removed from the working directory and index/i)).toBeInTheDocument()
    expect(screen.getByText(/untracked files are excluded/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /include untracked files \(optional\)/i })).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Create Stash' }))
    await waitFor(() => expect(api.CreateStash).toHaveBeenCalledWith('', false))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'stash:created' }))
    dispatch.mockRestore()
    for (const key of ['stashes', 'stashDiff', 'status', 'diff', 'commits', 'worktrees']) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] })
    }
    expect(client.getQueryState(['stashDiff', 0])?.isInvalidated).toBe(true)
    expect(useGitStore.getState().activeWorktree).toBe('/repo/wt')
    expect(useGitStore.getState().flash).toMatchObject({ type: 'success' })
  })

  it('sends the optional message and explicit untracked choice', async () => {
    openDialog()
    fireEvent.change(screen.getByLabelText('Message (optional)'), { target: { value: 'work in progress' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /include untracked/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Create Stash' }))
    await waitFor(() => expect(api.CreateStash).toHaveBeenCalledWith('work in progress', true))
  })

  it('blocks duplicate submissions and dismissal while pending', async () => {
    let resolve!: () => void
    api.CreateStash.mockReturnValue(new Promise<void>(r => { resolve = r }))
    const { onClose } = openDialog()
    const button = screen.getByRole('button', { name: 'Create Stash' })
    const form = button.closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled())
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(api.CreateStash).toHaveBeenCalledOnce()
    await act(async () => resolve())
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('shows backend errors, keeps the dialog open, and permits retry', async () => {
    api.CreateStash.mockRejectedValueOnce('fatal: cannot stash')
    const { onClose } = openDialog()
    const created = vi.fn()
    window.addEventListener('stash:created', created)
    fireEvent.click(screen.getByRole('button', { name: 'Create Stash' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot stash')
    expect(onClose).not.toHaveBeenCalled()
    expect(created).not.toHaveBeenCalled()
    window.removeEventListener('stash:created', created)
    fireEvent.click(screen.getByRole('button', { name: 'Create Stash' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('disables creation if the worktree changes, even if switched back', async () => {
    openDialog()
    act(() => {
      useGitStore.setState({ activeWorktree: '/other' })
      useGitStore.setState({ activeWorktree: '/repo/wt' })
    })
    expect(screen.getByRole('alert')).toHaveTextContent('worktree changed')
    expect(screen.getByRole('button', { name: 'Create Stash' })).toBeDisabled()
    expect(api.CreateStash).not.toHaveBeenCalled()
  })

  it('explains the optional untracked choice in German', async () => {
    await i18n.changeLanguage('de')
    openDialog()
    expect(screen.getByRole('checkbox', { name: 'Nicht verfolgte Dateien einbeziehen (optional)' })).not.toBeChecked()
  })
})
