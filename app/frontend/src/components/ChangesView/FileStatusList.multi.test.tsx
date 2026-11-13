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

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FileStatus, RepoStatus } from '@/lib/types'
import { FileStatusList } from './FileStatusList'
import { StageFiles, DiscardFiles, DiscardStagedFiles } from '@bindings/gitmorrow/app'

afterEach(() => cleanup())

// Two files with unstaged changes, two with staged changes.
const files: FileStatus[] = [
  { path: 'a.txt', oldPath: '', staged: '', unstaged: 'M', added: 1, deleted: 0 },
  { path: 'b.txt', oldPath: '', staged: '', unstaged: 'M', added: 1, deleted: 0 },
  { path: 'c.txt', oldPath: '', staged: 'M', unstaged: '', added: 1, deleted: 0 },
  { path: 'd.txt', oldPath: '', staged: 'M', unstaged: '', added: 1, deleted: 0 },
]

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const status: RepoStatus = { branch: 'main', ahead: 0, behind: 0, files, hasConflicts: false }
  queryClient.setQueryData(['status'], status)
  const onSelect = vi.fn()

  function Harness() {
    const [selected, setSelected] = useState({ path: null as string | null, staged: false })
    return <FileStatusList selectedFile={selected.path} selectedStaged={selected.staged}
      onSelectFile={(file, staged) => {
        onSelect(file, staged)
        setSelected({ path: file.path, staged })
      }} />
  }

  const { container } = render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>)
  const panel = container.querySelector<HTMLElement>('[data-panel="changes-filelist"]')!
  const row = (path: string, staged = false) =>
    Array.from(container.querySelectorAll<HTMLElement>('[data-file-path]'))
      .find(el => el.dataset.filePath === path && el.dataset.staged === String(staged))!
  return { panel, row, onSelect }
}

describe('changes file list multi-selection', () => {
  it('selects all files with Ctrl+A and shows the bulk action bar', () => {
    const { panel } = setup()
    expect(screen.queryByRole('toolbar', { name: 'Selected files' })).not.toBeInTheDocument()

    act(() => { fireEvent.keyDown(panel, { key: 'a', ctrlKey: true }) })

    const bar = screen.getByRole('toolbar', { name: 'Selected files' })
    expect(bar).toHaveTextContent('4 selected')
  })

  it('toggles single rows with Ctrl+click and keeps the diff selection on the clicked file', () => {
    const { row, onSelect } = setup()
    fireEvent.click(row('a.txt'), { ctrlKey: true })
    fireEvent.click(row('b.txt'), { ctrlKey: true })

    const bar = screen.getByRole('toolbar', { name: 'Selected files' })
    expect(bar).toHaveTextContent('2 selected')
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ path: 'b.txt' }), false)
  })

  it('clears the selection on a plain click', () => {
    const { row } = setup()
    fireEvent.click(row('a.txt'), { ctrlKey: true })
    expect(screen.getByRole('toolbar', { name: 'Selected files' })).toHaveTextContent('1 selected')

    fireEvent.click(row('b.txt'))
    expect(screen.queryByRole('toolbar', { name: 'Selected files' })).not.toBeInTheDocument()
  })

  it('stages all selected files in one call', async () => {
    const { row } = setup()
    fireEvent.click(row('a.txt'), { ctrlKey: true })
    fireEvent.click(row('b.txt'), { ctrlKey: true })
    const bar = screen.getByRole('toolbar', { name: 'Selected files' })
    fireEvent.click(within(bar).getByRole('button', { name: 'Stage' }))

    await waitFor(() => expect(StageFiles).toHaveBeenCalledWith(['a.txt', 'b.txt']))
  })

  it('discards the selected files, keeping staged and unstaged files apart', async () => {
    const { row } = setup()
    fireEvent.click(row('a.txt'), { ctrlKey: true })
    fireEvent.click(row('c.txt', true), { ctrlKey: true })
    const bar = screen.getByRole('toolbar', { name: 'Selected files' })
    fireEvent.click(within(bar).getByRole('button', { name: 'Discard' }))

    await waitFor(() => expect(DiscardFiles).toHaveBeenCalledWith(['a.txt']))
    await waitFor(() => expect(DiscardStagedFiles).toHaveBeenCalledWith(['c.txt']))
  })
})
