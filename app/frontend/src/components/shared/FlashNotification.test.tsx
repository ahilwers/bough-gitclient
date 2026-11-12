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

import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { ReportDiagnostic } from '@bindings/gitmorrow/app'
import FlashNotification from './FlashNotification'
import { useGitStore } from '@/stores/gitStore'
import '@/i18n'
vi.mock('./ErrorDetails', () => ({ ErrorDetails: ({ id }: { id: string }) => <div role="dialog">{id}</div> }))
afterEach(cleanup)
it('opens details from safe flash metadata and keeps the modal after flash expiry', () => {
  act(() => useGitStore.getState().showFlash('Git failed [git-error:abcdefgh23456789abcdefgh23]', 'danger'))
  render(<FlashNotification />)
  expect(ReportDiagnostic).toHaveBeenCalledWith('abcdefgh23456789abcdefgh23')
  expect(screen.getByText('Git failed')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Details' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('abcdefgh23456789abcdefgh23')
  act(() => useGitStore.getState().clearFlash())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
