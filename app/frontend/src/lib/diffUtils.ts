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

import type { DiffHunk } from './types'

/**
 * buildHunkPatch constructs a minimal unified diff patch for a single hunk,
 * suitable for `git apply --cached` (stage) or `git apply -R` (discard).
 */
export function buildHunkPatch(filePath: string, hunk: DiffHunk): string {
  const lines: string[] = []
  lines.push(`--- a/${filePath}`)
  lines.push(`+++ b/${filePath}`)
  lines.push(hunk.header)
  for (const line of hunk.lines) {
    if (line.type === 'add') lines.push(`+${line.content}`)
    else if (line.type === 'del') lines.push(`-${line.content}`)
    else lines.push(` ${line.content}`)
  }
  return lines.join('\n') + '\n'
}
