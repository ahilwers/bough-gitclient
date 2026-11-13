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
  it('returns Git output unchanged', () => {
    const raw = new Error(
      "git worktree failed (exit 128)\n" +
      "Preparing worktree (checking out 'test01')\n" +
      "fatal: 'test01' is already used by worktree at '/Users/user/repo'"
    )
    expect(parseGitError(raw)).toBe(
      "git worktree failed (exit 128)\n" +
      "Preparing worktree (checking out 'test01')\n" +
      "fatal: 'test01' is already used by worktree at '/Users/user/repo'"
    )
  })

  it('keeps every line, not only fatal/error/hint', () => {
    const raw = new Error("git push failed (exit 1)\nTo origin\n ! [rejected] main -> main")
    expect(parseGitError(raw)).toContain('To origin')
    expect(parseGitError(raw)).toContain('! [rejected]')
  })

  it('does not interpret the removed diagnostic marker', () => {
    expect(parseGitError(new Error('broken [git-error:abcdefgh23456789abcdefgh23]')))
      .toBe('broken [git-error:abcdefgh23456789abcdefgh23]')
  })

  it('handles a plain Error and a non-Error value', () => {
    expect(parseGitError(new Error('no repository open'))).toBe('no repository open')
    expect(parseGitError('something went wrong')).toBe('something went wrong')
  })
})
