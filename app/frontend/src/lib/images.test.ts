import { describe, it, expect } from 'vitest'
import { isImagePath, formatBytes } from './images'

describe('isImagePath', () => {
  it('recognises common image extensions', () => {
    expect(isImagePath('assets/photo.png')).toBe(true)
    expect(isImagePath('pic.JPG')).toBe(true)
    expect(isImagePath('logo.svg')).toBe(true)
    expect(isImagePath('anim.gif')).toBe(true)
    expect(isImagePath('pic.heic')).toBe(true)
  })

  it('rejects non-image files and nulls', () => {
    expect(isImagePath('notes.txt')).toBe(false)
    expect(isImagePath('file.png.js')).toBe(false) // extension is js
    expect(isImagePath(null)).toBe(false)
    expect(isImagePath(undefined)).toBe(false)
    expect(isImagePath('')).toBe(false)
  })
})

describe('formatBytes', () => {
  it('formats byte sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024 * 3)).toBe('3 MB')
    expect(formatBytes(-1)).toBe('0 B')
  })
})
