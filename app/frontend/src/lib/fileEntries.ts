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

import type { FileStatus } from './types'

/** A file row of the changes view: one file in one of the three sections. */
export interface FileEntry {
  file: FileStatus
  /** True for the row in the "Staged" section, false for "Conflicts" and "Unstaged". */
  staged: boolean
  /** Stable identity of the row across renders. */
  key: string
}

/** True when the file has unresolved merge conflicts. */
export function isConflictedStatus(file: FileStatus): boolean {
  return file.staged === 'U' || file.unstaged === 'U' ||
    (file.staged === 'A' && file.unstaged === 'A') ||
    (file.staged === 'D' && file.unstaged === 'D')
}

/**
 * Identity of a file row. The same path can appear in the "Unstaged" and in the
 * "Staged" section, so the section is part of the identity.
 */
export function fileEntryKey(file: FileStatus, staged: boolean): string {
  return `${staged ? 's' : 'u'}|${file.path}`
}

/**
 * All rows of the changes view in display order: conflicts, unstaged files and
 * staged files.
 */
export function buildFileEntries(files: FileStatus[]): FileEntry[] {
  const conflicted = files.filter(isConflictedStatus)
  const unstaged = files.filter(f => !isConflictedStatus(f) && (f.unstaged !== '' || f.staged === '?'))
  const staged = files.filter(f => !isConflictedStatus(f) && f.staged !== '' && f.staged !== '?')
  return [
    ...conflicted.map(f => ({ file: f, staged: false, key: fileEntryKey(f, false) })),
    ...unstaged.map(f => ({ file: f, staged: false, key: fileEntryKey(f, false) })),
    ...staged.map(f => ({ file: f, staged: true, key: fileEntryKey(f, true) })),
  ]
}
