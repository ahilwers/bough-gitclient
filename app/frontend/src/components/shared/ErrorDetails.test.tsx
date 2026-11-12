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

import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ErrorDetails, DiagnosticSettingsButton, DiagnosticMessage } from './ErrorDetails'
import { ReportDiagnostic, CopyRawDiagnostic, GetDiagnostic, GetDiagnosticSettings, SetDiagnosticLogging, OpenDiagnosticFolder } from '@bindings/gitmorrow/app'
import '@/i18n'

vi.mock('@bindings/gitmorrow/app', () => ({
  ReportDiagnostic: vi.fn().mockResolvedValue(undefined), CopyRawDiagnostic: vi.fn(), GetDiagnostic: vi.fn(), GetDiagnosticSettings: vi.fn(), SetDiagnosticLogging: vi.fn(), OpenDiagnosticFolder: vi.fn(),
}))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(GetDiagnostic).mockResolvedValue({ id: 'abcdefgh23456789abcdefgh23', operation: 'push', exitCode: 128, category: 'authentication' })
  vi.mocked(GetDiagnosticSettings).mockResolvedValue({ enabled: true, reason: '' })
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
})
afterEach(cleanup)
it('copies safe metadata but requires warning acknowledgement before raw copy', async () => {
  render(<ErrorDetails id="abcdefgh23456789abcdefgh23" onClose={vi.fn()} />)
  await screen.findByText(/128/)
  expect(CopyRawDiagnostic).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Copy safe summary' }))
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('push')))
  fireEvent.click(screen.getByRole('button', { name: 'Copy raw output…' }))
  expect(screen.getByText(/may contain passwords/)).toBeInTheDocument()
  expect(CopyRawDiagnostic).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(CopyRawDiagnostic).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Copy raw output…' }))
  fireEvent.click(screen.getByRole('button', { name: 'I understand — copy raw output' }))
  await waitFor(() => expect(CopyRawDiagnostic).toHaveBeenCalledWith('abcdefgh23456789abcdefgh23', true))
  fireEvent.click(screen.getByRole('button', { name: 'Open log folder' }))
  await waitFor(() => expect(OpenDiagnosticFolder).toHaveBeenCalled())
})
it('shows and reports inline Git errors without displaying diagnostic IDs', async () => {
  render(<DiagnosticMessage message="Git failed [git-error:abcdefgh23456789abcdefgh23]" />)
  expect(screen.getByText('Git failed')).toBeInTheDocument()
  expect(ReportDiagnostic).toHaveBeenCalledWith('abcdefgh23456789abcdefgh23')
  fireEvent.click(screen.getByRole('button', { name: 'Details' }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
})
it('offers persistent logging settings without needing an error', async () => {
  render(<DiagnosticSettingsButton />)
  fireEvent.click(screen.getByRole('button', { name: 'Diagnostic settings' }))
  const checkbox = await screen.findByRole('checkbox', { name: 'Record local Git failure metadata' })
  expect(checkbox).toBeChecked()
  fireEvent.click(checkbox)
  await waitFor(() => expect(SetDiagnosticLogging).toHaveBeenCalledWith(false))
})
