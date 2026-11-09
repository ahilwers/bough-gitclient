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

import { ThemeMenu } from '../shared/ThemeMenu'
import { useGitStore } from '@/stores/gitStore'

export default function Titlebar() {
  const { activeRepo } = useGitStore()
  const repoName = activeRepo ? activeRepo.split('/').pop() : null

  return (
    <div
      style={{
        height: 40,
        background: 'var(--bg-titlebar)',
        borderBottom: '1px solid var(--border-sub)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 80,   // space for macOS traffic lights
        paddingRight: 12,
        // @ts-expect-error webkit drag region
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      }}
    >
      {/* App + repo title */}
      <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-pri)' }}>
        GitMorrow
        {repoName && (
          <span style={{ fontWeight: 400, color: 'var(--text-ter)', marginLeft: 8 }}>
            — {repoName}
          </span>
        )}
      </div>

      {/* Theme menu — must opt out of window drag */}
      <ThemeMenu
        style={{
          // @ts-expect-error webkit no-drag
          WebkitAppRegion: 'no-drag',
          width: 28,
          height: 28,
        }}
      />
    </div>
  )
}
