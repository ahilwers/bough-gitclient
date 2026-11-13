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

/**
 * Returns the first 7 characters of a git hash.
 * If the string is shorter than 7 chars it is returned as-is.
 */
export function shortHash(hash: string): string {
  return hash.length > 7 ? hash.slice(0, 7) : hash
}

/**
 * Formats a date as a human-readable relative string (e.g. "3 days ago").
 * Falls back to locale date string for dates older than a year.
 */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diff = now - d.getTime()

  const minute = 60_000
  const hour   = 60 * minute
  const day    = 24 * hour
  const week   = 7  * day
  const month  = 30 * day
  const year   = 365 * day

  if (diff < minute)      return 'just now'
  if (diff < hour)        return `${Math.floor(diff / minute)} min ago`
  if (diff < day)         return `${Math.floor(diff / hour)} hours ago`
  if (diff < week)        return `${Math.floor(diff / day)} days ago`
  if (diff < month)       return `${Math.floor(diff / week)} weeks ago`
  if (diff < year)        return `${Math.floor(diff / month)} months ago`
  return d.toLocaleDateString()
}

/**
 * Returns the last component of a file path (the filename).
 */
export function basename(path: string): string {
  return path.split('/').pop() ?? path
}

/**
 * Returns the message of a failed Git call.
 *
 * Wails rejects the promise with the Go error's text. Since #30 that text is
 * Git's own output, prefixed with the operation and exit code, so it is shown
 * here without any filtering: the toast renders the first lines and the
 * details dialog the complete text.
 */
export function parseGitError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.trim()
}
