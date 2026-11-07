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

import { describe, it, expect } from 'vitest'
import { buildHunkPatch } from './diffUtils'
import type { DiffHunk } from './types'

const makeHunk = (overrides: Partial<DiffHunk> = {}): DiffHunk => ({
  header: '@@ -1,3 +1,3 @@',
  oldStart: 1, oldLines: 3,
  newStart: 1, newLines: 3,
  lines: [
    { type: 'ctx', content: 'line1', oldNo: 1, newNo: 1 },
    { type: 'del', content: 'line2', oldNo: 2, newNo: 0 },
    { type: 'add', content: 'LINE2', oldNo: 0, newNo: 2 },
    { type: 'ctx', content: 'line3', oldNo: 3, newNo: 3 },
  ],
  ...overrides,
})

describe('buildHunkPatch', () => {
  it('starts with the file headers', () => {
    const patch = buildHunkPatch('src/foo.ts', makeHunk())
    expect(patch).toContain('--- a/src/foo.ts\n')
    expect(patch).toContain('+++ b/src/foo.ts\n')
  })

  it('includes the hunk header', () => {
    const patch = buildHunkPatch('foo.txt', makeHunk({ header: '@@ -1,3 +1,3 @@' }))
    expect(patch).toContain('@@ -1,3 +1,3 @@\n')
  })

  it('prefixes add lines with +', () => {
    const patch = buildHunkPatch('foo.txt', makeHunk())
    expect(patch).toContain('+LINE2\n')
  })

  it('prefixes del lines with -', () => {
    const patch = buildHunkPatch('foo.txt', makeHunk())
    expect(patch).toContain('-line2\n')
  })

  it('prefixes ctx lines with a space', () => {
    const patch = buildHunkPatch('foo.txt', makeHunk())
    expect(patch).toContain(' line1\n')
    expect(patch).toContain(' line3\n')
  })

  it('ends with a newline', () => {
    const patch = buildHunkPatch('foo.txt', makeHunk())
    expect(patch.endsWith('\n')).toBe(true)
  })

  it('handles empty lines array', () => {
    const patch = buildHunkPatch('foo.txt', makeHunk({ lines: [] }))
    expect(patch).toContain('--- a/foo.txt')
    expect(patch).toContain('+++ b/foo.txt')
  })

  it('works with nested paths', () => {
    const patch = buildHunkPatch('a/b/c/file.go', makeHunk())
    expect(patch).toContain('--- a/a/b/c/file.go\n')
    expect(patch).toContain('+++ b/a/b/c/file.go\n')
  })
})
