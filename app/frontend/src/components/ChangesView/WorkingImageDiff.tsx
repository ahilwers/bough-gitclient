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

import { ImageDiffView } from '@/components/shared/ImageDiffView'
import { useWorkingImageDiff } from '@/hooks/useImageDiff'

interface WorkingImageDiffProps {
  filePath: string
  staged: boolean
  isUntracked: boolean
}

/**
 * Side-by-side image diff for uncommitted changes:
 * untracked → worktree only · staged → HEAD vs index · unstaged → index vs worktree.
 */
export function WorkingImageDiff({ filePath, staged, isUntracked }: WorkingImageDiffProps) {
  const { left, right, isLoading } = useWorkingImageDiff(filePath, staged, isUntracked)

  const leftLabel = staged ? 'HEAD' : 'Index'
  const rightLabel = staged ? 'Index' : 'Worktree'

  return (
    <div style={{ flex: 1, minHeight: 0, padding: 8, boxSizing: 'border-box', background: 'var(--bg-content)' }}>
      <ImageDiffView
        left={left}
        right={right}
        leftLabel={leftLabel}
        rightLabel={rightLabel}
        leftEmptyHint="No image in previous version"
        rightEmptyHint="No image in current version"
        loading={isLoading}
      />
    </div>
  )
}
