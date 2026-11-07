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
import { useStashImageDiff } from '@/hooks/useImageDiff'

interface StashImageDiffProps {
  index: number
  filePath: string
}

/**
 * Side-by-side image diff for a stash entry: the base commit (pre-stash state)
 * versus the image as saved inside the stash itself.
 */
export function StashImageDiff({ index, filePath }: StashImageDiffProps) {
  const { base, stash, isLoading } = useStashImageDiff(index, filePath)

  return (
    <div style={{ height: '100%', padding: 8, boxSizing: 'border-box', background: 'var(--bg-content)' }}>
      <ImageDiffView
        left={base}
        right={stash}
        leftLabel="Base (before stash)"
        rightLabel="Stash"
        leftEmptyHint="Image not present before stashing"
        rightEmptyHint="Image not present in stash"
        loading={isLoading}
      />
    </div>
  )
}
