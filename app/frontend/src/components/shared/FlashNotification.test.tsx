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

import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import FlashNotification from './FlashNotification'
import { useGitStore } from '@/stores/gitStore'
import '@/i18n'

const shortMessage = "git worktree failed (exit 128)\nfatal: 'test01' is already used by worktree at '/tmp/boughtest'"
const longMessage = [
  'git push failed (exit 1)',
  'To https://example.com/repo.git',
  ' ! [rejected]        main -> main (non-fast-forward)',
  'error: failed to push some refs to https://example.com/repo.git',
  'hint: Updates were rejected because the tip of your current branch is behind',
].join('\n')

afterEach(() => {
  cleanup()
  act(() => useGitStore.getState().clearFlash())
})

describe('flash notification', () => {
  it('shows Git’s message unchanged and no details link when it fits', () => {
    act(() => useGitStore.getState().showFlash(shortMessage, 'danger'))
    render(<FlashNotification />)

    expect(screen.getByTestId('flash-message')).toHaveTextContent("fatal: 'test01' is already used by worktree at '/tmp/boughtest'")
    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument()
  })

  it('offers details for a long message and shows the complete text', () => {
    act(() => useGitStore.getState().showFlash(longMessage, 'danger'))
    render(<FlashNotification />)

    fireEvent.click(screen.getByRole('button', { name: 'Details' }))

    const dialog = screen.getByRole('dialog')
    const detailText = within(dialog).getByTestId('error-details-text')
    expect(detailText.textContent).toBe(longMessage)
    expect(detailText).toHaveTextContent('rejected] main -> main (non-fast-forward)')
  })

  it('keeps the details dialog open after the toast expires', () => {
    act(() => useGitStore.getState().showFlash(longMessage, 'danger'))
    render(<FlashNotification />)
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))

    act(() => useGitStore.getState().clearFlash())

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows success messages without a details link', () => {
    act(() => useGitStore.getState().showFlash('Pulled successfully', 'success'))
    render(<FlashNotification />)

    expect(screen.getByTestId('flash-message')).toHaveTextContent('Pulled successfully')
    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument()
  })
})
