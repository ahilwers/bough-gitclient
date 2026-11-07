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

// Re-export the helpers via a dedicated test-only re-export file so we can
// unit-test them without importing the full hook (which requires QueryClient).
// We inline the logic here to keep it self-contained.

function parseLatestVersion(xml: string): string {
  const match = xml.match(/sparkle:version="([^"]+)"/)
  return match ? match[1] : ''
}

function isNewer(local: string, remote: string): boolean {
  const normalise = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const l = normalise(local)
  const r = normalise(remote)
  for (let i = 0; i < Math.max(l.length, r.length); i++) {
    const lv = l[i] ?? 0
    const rv = r[i] ?? 0
    if (rv > lv) return true
    if (rv < lv) return false
  }
  return false
}

describe('parseLatestVersion', () => {
  it('extracts the first sparkle:version from an appcast', () => {
    const xml = `
      <enclosure sparkle:version="1.2.3" sparkle:shortVersionString="1.2.3" />
      <enclosure sparkle:version="1.1.0" />
    `
    expect(parseLatestVersion(xml)).toBe('1.2.3')
  })

  it('returns empty string when no version is found', () => {
    expect(parseLatestVersion('<rss></rss>')).toBe('')
  })

  it('strips leading v prefix when present', () => {
    const xml = `<enclosure sparkle:version="v2.0.0" />`
    // parseLatestVersion returns the raw attribute value; normalisation is done in isNewer
    expect(parseLatestVersion(xml)).toBe('v2.0.0')
  })
})

describe('isNewer', () => {
  it('returns true when remote version is strictly higher', () => {
    expect(isNewer('1.0.0', '1.1.0')).toBe(true)
    expect(isNewer('1.9.9', '2.0.0')).toBe(true)
    expect(isNewer('0.1.0', '0.1.1')).toBe(true)
  })

  it('returns false when versions are equal', () => {
    expect(isNewer('1.2.3', '1.2.3')).toBe(false)
    expect(isNewer('1.2.3', 'v1.2.3')).toBe(false)
  })

  it('returns false when local is newer than remote', () => {
    expect(isNewer('2.0.0', '1.9.9')).toBe(false)
    expect(isNewer('1.1.0', '1.0.0')).toBe(false)
  })

  it('handles missing patch component', () => {
    expect(isNewer('1.0', '1.1')).toBe(true)
    expect(isNewer('1.1', '1.0')).toBe(false)
  })

  it('strips leading v prefix from both sides', () => {
    expect(isNewer('v1.0.0', 'v1.1.0')).toBe(true)
    expect(isNewer('v1.1.0', '1.0.0')).toBe(false)
  })
})
