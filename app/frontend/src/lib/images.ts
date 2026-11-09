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

// Frontend mirror of the Go ImageSource type (git/types.go) plus image helpers.

export interface ImageSource {
  dataURL: string
  size: number
}

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp',
  'ico', 'tif', 'tiff', 'avif', 'heic', 'heif', 'svg',
])

/** True when the file path points at a raster or vector image (by extension). */
export function isImagePath(path: string | null | undefined): boolean {
  if (!path) return false
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.has(ext)
}

/** Formats a byte count in a human-friendly way (e.g. "3.2 KB"). */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** i
  const decimals = Number.isInteger(value) ? 0 : value >= 10 ? 0 : 1
  return `${value.toFixed(decimals)} ${units[i]}`
}
