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

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { Button } from './Button'
import { useGitStore, type Theme } from '@/stores/gitStore'

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={13} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={13} /> },
  { value: 'system', label: 'System', icon: <Monitor size={13} /> },
]

interface ThemeMenuProps {
  /** Extra styles for the trigger button (e.g. Titlebar sizing/no-drag). */
  style?: React.CSSProperties
}

/** Dropdown to pick the theme preference: Light, Dark, or follow the OS (System). */
export function ThemeMenu({ style }: ThemeMenuProps) {
  const { theme, resolvedTheme, setTheme } = useGitStore()

  const resolvedIcon = resolvedTheme === 'dark' ? <Moon size={14} /> : <Sun size={14} />
  const triggerIcon = theme === 'system' ? <Monitor size={14} /> : resolvedIcon
  const title = theme === 'system'
    ? 'Theme: System'
    : `Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="icon"
          aria-label="Theme"
          title={title}
          style={style ?? { width: 30, height: 30 }}
        >
          {triggerIcon}
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '4px 0',
            minWidth: 180,
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '2px 12px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-ter)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Theme
          </div>
          {THEME_OPTIONS.map(opt => (
            <DropdownMenu.Item
              key={opt.value}
              onSelect={() => setTheme(opt.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', fontSize: 12, cursor: 'pointer',
                color: theme === opt.value ? 'var(--acc)' : 'var(--text-pri)',
                outline: 'none',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-content)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ flexShrink: 0, display: 'flex', color: 'var(--text-ter)' }}>{opt.icon}</span>
              <span style={{ flex: 1 }}>{opt.label}</span>
              {theme === opt.value && <Check size={13} style={{ flexShrink: 0, color: 'var(--acc)' }} />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
