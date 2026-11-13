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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ErrorDetails, ErrorMessage, isLongMessage } from './ErrorDetails'
import '@/i18n'

const longMessage = [
  'git push failed (exit 1)',
  'To https://example.com/repo.git',
  ' ! [rejected]        main -> main (non-fast-forward)',
  'error: failed to push some refs to https://example.com/repo.git',
].join('\n')

afterEach(cleanup)

describe('isLongMessage', () => {
  it('treats a two-line failure as short', () => {
    expect(isLongMessage("git add failed (exit 1)\nfatal: pathspec 'x' did not match")).toBe(false)
  })

  it('treats more than three lines as long', () => {
    expect(isLongMessage(longMessage)).toBe(true)
  })

  it('treats a single very long line as long', () => {
    expect(isLongMessage('git push failed (exit 1)\n' + 'x'.repeat(300))).toBe(true)
  })
})

describe('ErrorMessage', () => {
  it('renders a short message without a details link', () => {
    render(<ErrorMessage message="fatal: not a git repository" />)
    expect(screen.getByText('fatal: not a git repository')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument()
  })

  it('opens the complete text for a long message', () => {
    render(<ErrorMessage message={longMessage} />)
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(within(screen.getByRole('dialog')).getByTestId('error-details-text').textContent).toBe(longMessage)
  })
})

describe('ErrorDetails', () => {
  it('shows the unmodified output and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    render(<ErrorDetails text={longMessage} onClose={vi.fn()} />)

    expect(screen.getByTestId('error-details-text').textContent).toBe(longMessage)
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(longMessage))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument())
  })

  it('closes on request', () => {
    const onClose = vi.fn()
    render(<ErrorDetails text={longMessage} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
