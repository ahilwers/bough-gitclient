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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGitStore } from '@/stores/gitStore'
import type { CommitNode, RepoStatus } from '@/lib/types'
import { CommitBox } from './CommitBox'

function commit(hash: string, fullMessage: string): CommitNode {
  return {
    hash, shortHash: hash, message: fullMessage.split('\n')[0], fullMessage,
    author: 'Achim', email: 'a@example.com', date: new Date('2026-11-01T10:00:00Z'),
    parents: [], refs: [], column: 0, color: 0, lines: [],
  }
}

const commits = [
  commit('1111111', 'fix: newest change'),
  commit('2222222', 'feat: middle change\n\nWith a body paragraph.'),
  commit('3333333', 'fix: newest change'), // duplicate text keeps one slot
  commit('4444444', 'chore: oldest change'),
]

function renderBox() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const status: RepoStatus = { branch: 'main', ahead: 0, behind: 0, files: [], hasConflicts: false }
  client.setQueryData(['status'], status)
  client.setQueryData(['commits', 50, false], commits)
  render(<QueryClientProvider client={client}><CommitBox /></QueryClientProvider>)
  return document.querySelector<HTMLTextAreaElement>('[data-commit-input]')!
}

function setCaret(el: HTMLTextAreaElement, offset: number) {
  el.setSelectionRange(offset, offset)
}

describe('commit box message history', () => {
  beforeEach(() => {
    useGitStore.setState({ activeRepo: '/tmp/test-repo', activeWorktree: null })
  })

  afterEach(() => {
    cleanup()
    useGitStore.setState({ activeRepo: null, activeWorktree: null })
  })

  it('browses previous commit messages with ArrowUp and returns to the draft with ArrowDown', () => {
    const input = renderBox()
    fireEvent.change(input, { target: { value: 'my own draft' } })

    setCaret(input, 0)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('fix: newest change')

    setCaret(input, 0)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('feat: middle change\n\nWith a body paragraph.')

    setCaret(input, 0)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('chore: oldest change')

    // Past the oldest message nothing changes.
    setCaret(input, 0)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('chore: oldest change')

    setCaret(input, input.value.length)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('feat: middle change\n\nWith a body paragraph.')

    setCaret(input, input.value.length)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('fix: newest change')

    setCaret(input, input.value.length)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('my own draft')
  })

  it('leaves arrow keys alone while the caret is inside the text', () => {
    const input = renderBox()
    fireEvent.change(input, { target: { value: 'first line\nsecond line' } })

    setCaret(input, 5)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('first line\nsecond line')

    setCaret(input, 5)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('first line\nsecond line')
  })

  it('stops browsing once the message is edited', () => {
    const input = renderBox()
    fireEvent.change(input, { target: { value: 'draft' } })

    setCaret(input, 0)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('fix: newest change')

    fireEvent.change(input, { target: { value: 'edited text' } })
    setCaret(input, 0)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('fix: newest change')

    setCaret(input, input.value.length)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('edited text')
  })

  it('does nothing when no previous messages exist', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    client.setQueryData(['status'], { branch: 'main', ahead: 0, behind: 0, files: [], hasConflicts: false })
    client.setQueryData(['commits', 50, false], [])
    render(<QueryClientProvider client={client}><CommitBox /></QueryClientProvider>)
    const input = document.querySelector<HTMLTextAreaElement>('[data-commit-input]')!
    fireEvent.change(input, { target: { value: 'draft' } })

    setCaret(input, 0)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('draft')
  })

  it('does not intercept modified arrow keys', () => {
    const input = renderBox()
    fireEvent.change(input, { target: { value: 'draft' } })
    setCaret(input, 0)
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true })
    expect(input.value).toBe('draft')
  })
})
