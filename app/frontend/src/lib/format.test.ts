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

import { describe, it, expect } from 'vitest'
import { shortHash, formatRelativeDate, basename, parseGitError } from './format'

describe('shortHash', () => {
  it('returns first 7 chars of a full hash', () => {
    expect(shortHash('abc1234567890abcdef')).toBe('abc1234')
  })
  it('returns the full string if shorter than 7', () => {
    expect(shortHash('abc')).toBe('abc')
  })
  it('returns exactly 7 chars when given exactly 7', () => {
    expect(shortHash('abc1234')).toBe('abc1234')
  })
  it('handles empty string', () => {
    expect(shortHash('')).toBe('')
  })
})

describe('formatRelativeDate', () => {
  it('returns "just now" for very recent dates', () => {
    const recent = new Date(Date.now() - 5000) // 5 seconds ago
    expect(formatRelativeDate(recent)).toBe('just now')
  })
  it('returns minutes for sub-hour dates', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    expect(formatRelativeDate(tenMinutesAgo)).toBe('10 min ago')
  })
  it('returns days for sub-week dates', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    expect(formatRelativeDate(threeDaysAgo)).toBe('3 days ago')
  })
  it('accepts a date string', () => {
    const result = formatRelativeDate(new Date(Date.now() - 1000).toISOString())
    expect(result).toBe('just now')
  })
})

describe('basename', () => {
  it('returns the filename from a path', () => {
    expect(basename('src/components/Toolbar.tsx')).toBe('Toolbar.tsx')
  })
  it('returns the value unchanged if no slash', () => {
    expect(basename('main.go')).toBe('main.go')
  })
  it('handles trailing slash gracefully', () => {
    expect(basename('src/')).toBe('')
  })
})

describe('parseGitError', () => {
  it('uses safe structured metadata without retaining backend text', () => {
    const error = new Error('secret-token', { cause: { id: 'abcdefgh23456789abcdefgh23', operation: 'push', exitCode: 128, category: 'authentication' } })
    const message = parseGitError(error)
    expect(message).not.toContain('secret-token')
    expect(message).toContain('[git-error:abcdefgh23456789abcdefgh23]')
  })
  it('extracts the fatal: line from a typical git worktree error', () => {
    const raw = new Error(
      "git [worktree add ../gitclient-worktree main]: exit status 128\n" +
      "Preparing worktree (checking out 'main')\n" +
      "fatal: 'main' is already used by worktree at '/Users/user/repo'\n"
    )
    expect(parseGitError(raw)).toBe("'main' is already used by worktree at '/Users/user/repo'")
  })

  it('extracts the error: line', () => {
    const raw = new Error(
      "git [push origin main]: exit status 1\n" +
      "error: failed to push some refs to 'origin'\n"
    )
    expect(parseGitError(raw)).toBe("failed to push some refs to 'origin'")
  })

  it('joins multiple fatal/error lines', () => {
    const raw = new Error(
      "git [merge feature]: exit status 1\n" +
      "error: Your local changes would be overwritten by merge.\n" +
      "error: Please commit or stash them.\n"
    )
    expect(parseGitError(raw)).toBe(
      "Your local changes would be overwritten by merge.\nPlease commit or stash them."
    )
  })

  it('strips the command prefix when there is no fatal/error line', () => {
    const raw = new Error(
      "git [status --porcelain=v1]: exit status 1\nsome unexpected output"
    )
    expect(parseGitError(raw)).toBe('some unexpected output')
  })

  it('handles plain Error with no git prefix', () => {
    expect(parseGitError(new Error('no repository open'))).toBe('no repository open')
  })

  it('handles a non-Error value', () => {
    expect(parseGitError('something went wrong')).toBe('something went wrong')
  })

  it('is case-insensitive for the prefix keywords', () => {
    const raw = new Error("Fatal: not a git repo")
    expect(parseGitError(raw)).toBe('not a git repo')
  })
})
