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

import type { CommitNode } from './types'

/** Number of distinct messages the commit box keeps available. */
export const MAX_COMMIT_MESSAGE_HISTORY = 50

/**
 * Builds the commit message history offered by the commit box, newest first.
 *
 * Messages are taken verbatim from previous commits so multi-line bodies stay
 * usable. Repeated texts (merge commits, rebases) and empty messages are
 * collapsed into a single slot.
 */
export function buildCommitMessageHistory(
  commits: CommitNode[] | undefined,
  limit = MAX_COMMIT_MESSAGE_HISTORY,
): string[] {
  if (!commits || limit <= 0) return []

  const seen = new Set<string>()
  const messages: string[] = []

  for (const commit of commits) {
    const message = (commit.fullMessage ?? '').trim()
    if (!message || seen.has(message)) continue
    seen.add(message)
    messages.push(message)
    if (messages.length >= limit) break
  }

  return messages
}
