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

interface Hint {
  keys: string[]
  label: string
}

interface KeyHintsProps {
  hints: Hint[]
}

export function KeyHints({ hints }: KeyHintsProps) {
  return (
    <div style={{
      flexShrink: 0,
      height: 24,
      borderTop: '1px solid var(--border-sub)',
      background: 'var(--bg-toolbar)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 12px',
      overflow: 'hidden',
    }}>
      {hints.map((h, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {h.keys.map((k, j) => (
            <kbd key={j} style={{
              padding: '0 4px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'var(--bg-badge)',
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: 600,
              color: 'var(--text-sec)',
              lineHeight: '16px',
            }}>
              {k}
            </kbd>
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-ter)' }}>{h.label}</span>
        </span>
      ))}
    </div>
  )
}
