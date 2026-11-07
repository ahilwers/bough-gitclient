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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGitStore } from '@/stores/gitStore'
import Toolbar from './Toolbar'

function renderToolbar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}><Toolbar /></QueryClientProvider>)
}
beforeEach(() => useGitStore.setState({ activeRepo: '/projects/gitclient', activeWorktree: null, recentRepos: [], helpDialogOpen: false }))
afterEach(cleanup)

describe('repository selector layout', () => {
  it.each(['gitclient', 'repository-with-a-very-long-name-'.repeat(10), 'Mein Repository mit Leerzeichen'])('keeps the name and arrow in one horizontal row (%s)', name => {
    useGitStore.setState({ activeRepo: `/projects/${name}` })
    renderToolbar()
    const button = screen.getByRole('button', { name })
    expect(button).toHaveStyle({ display: 'inline-flex', flexDirection: 'row', flexWrap: 'nowrap', whiteSpace: 'nowrap', minWidth: '44px', maxWidth: '200px' })
    const label = button.querySelector('span')!
    expect(label).toHaveTextContent(name)
    expect(label).toHaveStyle({ flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
    const arrow = button.querySelector('svg')!
    expect(arrow).toHaveStyle({ flexShrink: '0' })
    expect(arrow).toHaveAttribute('aria-hidden', 'true')
    expect(label.nextElementSibling).toBe(arrow)
    expect(button).toHaveAttribute('title', `/projects/${name}`)
  })

  it('keeps the same layout when no repository is open', () => {
    useGitStore.setState({ activeRepo: null })
    renderToolbar()
    expect(screen.getByRole('button', { name: 'No Repository' })).toHaveStyle({ flexDirection: 'row', flexWrap: 'nowrap' })
  })

  it('still opens the repository menu', async () => {
    const user = userEvent.setup()
    renderToolbar()
    await user.click(screen.getByRole('button', { name: 'gitclient' }))
    expect(await screen.findByRole('menuitem', { name: 'Open Repository…' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'New Repository…' })).toBeInTheDocument()
  })
})
