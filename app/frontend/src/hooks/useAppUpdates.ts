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

import { useQuery } from '@tanstack/react-query'
import { GetAppVersion } from '@bindings/gitmorrow/app'

const APPCAST_URL = 'https://updates.bough.app/appcast.xml'

interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
}

/**
 * Parses the first sparkle:version attribute from the appcast XML string.
 * Returns an empty string when no version entry is found.
 */
function parseLatestVersion(xml: string): string {
  // Use a regex rather than DOMParser so tests can run in Node without jsdom quirks.
  const match = xml.match(/sparkle:version="([^"]+)"/)
  return match ? match[1] : ''
}

/**
 * Compares two semver-like version strings (e.g. "1.2.3" or "v1.2.3").
 * Returns true when `remote` is strictly newer than `local`.
 */
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

/**
 * useAppUpdates — checks the appcast once per hour and returns the current
 * and latest version strings, plus a boolean indicating whether an update is
 * available.
 *
 * The native Sparkle / WinSparkle updater handles the actual download and
 * install flow; this hook is used only to drive in-app update notifications.
 */
export function useAppUpdates() {
  return useQuery<UpdateInfo>({
    queryKey: ['app-updates'],
    queryFn: async () => {
      const currentVersion = await GetAppVersion()

      // Silence network errors silently — update checks are best-effort.
      let latestVersion = ''
      try {
        const response = await fetch(APPCAST_URL, {
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (response.ok) {
          const xml = await response.text()
          latestVersion = parseLatestVersion(xml)
        }
      } catch {
        // Network unavailable — not an error condition.
      }

      return {
        currentVersion,
        latestVersion,
        updateAvailable: latestVersion !== '' && isNewer(currentVersion, latestVersion),
      }
    },
    staleTime: 60 * 60 * 1000,  // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: false,
    refetchOnWindowFocus: false,
  })
}
