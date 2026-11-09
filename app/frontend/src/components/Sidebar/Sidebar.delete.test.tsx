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

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useGitStore } from '@/stores/gitStore'
import Sidebar from './Sidebar'

const dialog = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useBranches', () => ({ useBranches: () => ({ data: {
  local: [{ name: 'main', remote: '', isHead: true }, { name: 'topic', remote: '', isHead: false }],
  remotes: [{ name: 'upstream/team/topic', remote: 'upstream', isHead: false }],
} }) }))
vi.mock('@/hooks/useWorktrees', () => ({ useWorktrees: () => ({ data: [] }) }))
vi.mock('@/hooks/useTags', () => ({ useTags: () => ({ data: [] }) }))
vi.mock('@/hooks/useStashes', () => ({ useStashes: () => ({ data: [] }) }))
vi.mock('@/hooks/useStatus', () => ({ useStatus: () => ({}) }))
vi.mock('@/hooks/useCherryPick', () => ({ useCherryPick: () => ({}) }))
vi.mock('@/components/BranchManager/DeleteBranchDialog', () => ({ DeleteBranchDialog: (props: unknown) => { dialog(props); return null } }))
// Render menu items directly so both branch entries can be inspected without Radix pointer-event plumbing.
vi.mock('@/components/shared/ContextMenu', async () => {
  const { Button } = await import('@/components/shared/Button')
  return { ContextMenu: ({ items, children }: { items: { label?: string; onClick?: () => void }[]; children: React.ReactNode }) => <div>{children}{items.filter(item => item.label).map(item => <Button key={item.label} onClick={item.onClick}>{item.label}</Button>)}</div> }
})

beforeEach(() => {
  dialog.mockClear()
  useGitStore.setState({ activeRepo: '/repo', activeWorktree: '/wt' })
})
afterEach(cleanup)

it('offers deletion only for non-HEAD local branches and passes the original fields', () => {
  render(<Sidebar />)
  expect(screen.getAllByRole('button', { name: 'Delete local branch' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Delete local branch' }))
  expect(dialog).toHaveBeenLastCalledWith(expect.objectContaining({ target: { name: 'topic', remote: '', isRemote: false, repo: '/repo', worktree: '/wt' } }))
})

it('offers deletion for remote branches and passes the unmodified remote and branch names', () => {
  render(<Sidebar />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete remote branch' }))
  expect(dialog).toHaveBeenLastCalledWith(expect.objectContaining({ target: { name: 'upstream/team/topic', remote: 'upstream', isRemote: true, repo: '/repo', worktree: '/wt' } }))
})
