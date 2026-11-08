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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GetAppVersion } from '@bindings/bough/app'
import { useGitStore } from '@/stores/gitStore'
import { AboutDialog } from './AboutDialog'

describe('AboutDialog', () => {
  beforeEach(() => {
    vi.mocked(GetAppVersion).mockReset().mockResolvedValue('1.2.3')
    useGitStore.setState({ aboutDialogOpen: true })
  })
  afterEach(() => cleanup())

  it('renders nothing while closed', () => {
    useGitStore.setState({ aboutDialogOpen: false })
    render(<AboutDialog />)
    expect(screen.queryByRole('dialog', { name: 'About Bough' })).not.toBeInTheDocument()
  })

  it('shows the version reported by the backend', async () => {
    render(<AboutDialog />)
    expect(await screen.findByTestId('about-version')).toHaveTextContent('1.2.3')
    expect(screen.getByRole('dialog', { name: 'About Bough' })).toBeInTheDocument()
  })

  it('strips a leading v from the version', async () => {
    vi.mocked(GetAppVersion).mockResolvedValue('v2.0.0')
    render(<AboutDialog />)
    expect(await screen.findByTestId('about-version')).toHaveTextContent('2.0.0')
  })

  it('labels development builds instead of printing "dev"', async () => {
    vi.mocked(GetAppVersion).mockResolvedValue('dev')
    render(<AboutDialog />)
    expect(await screen.findByTestId('about-version')).toHaveTextContent('Development build')
  })

  it('closes via the close button', async () => {
    render(<AboutDialog />)
    await screen.findByTestId('about-version')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(useGitStore.getState().aboutDialogOpen).toBe(false))
  })

  it('closes on Escape', async () => {
    render(<AboutDialog />)
    await screen.findByTestId('about-version')

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(useGitStore.getState().aboutDialogOpen).toBe(false))
  })

  it('falls back to a development label when the version cannot be read', async () => {
    vi.mocked(GetAppVersion).mockRejectedValue(new Error('boom'))
    render(<AboutDialog />)
    expect(await screen.findByTestId('about-version')).toHaveTextContent('Development build')
  })
})
