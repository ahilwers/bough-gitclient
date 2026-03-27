import { describe, it, expect } from 'vitest'
import { shortHash, formatRelativeDate, maskLicenseKey, basename } from './format'

describe('shortHash', () => {
  it('returns first 7 chars of a full hash', () => {
    expect(shortHash('abc1234567890abcdef')).toBe('abc1234')
  })
  it('returns the full string if shorter than 7', () => {
    expect(shortHash('abc')).toBe('abc')
  })
  it('returns exactly 7 chars when given exactly 7', () => {
    expect(shortHash('abc1234')).toBe('abc1234')
  })
  it('handles empty string', () => {
    expect(shortHash('')).toBe('')
  })
})

describe('maskLicenseKey', () => {
  it('masks all but the first two segments', () => {
    expect(maskLicenseKey('BOUGH-A3F2K-XMPL9-QZ7RT-4WJHB'))
      .toBe('BOUGH-A3F2K-****-****-****')
  })
  it('handles a key with exactly 2 segments (no masking needed)', () => {
    expect(maskLicenseKey('BOUGH-A3F2K')).toBe('BOUGH-A3F2K')
  })
  it('handles a key with 3 segments', () => {
    expect(maskLicenseKey('BOUGH-A3F2K-XMPL9')).toBe('BOUGH-A3F2K-****')
  })
})

describe('formatRelativeDate', () => {
  it('returns "just now" for very recent dates', () => {
    const recent = new Date(Date.now() - 5000) // 5 seconds ago
    expect(formatRelativeDate(recent)).toBe('just now')
  })
  it('returns minutes for sub-hour dates', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    expect(formatRelativeDate(tenMinutesAgo)).toBe('10 min ago')
  })
  it('returns days for sub-week dates', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    expect(formatRelativeDate(threeDaysAgo)).toBe('3 days ago')
  })
  it('accepts a date string', () => {
    const result = formatRelativeDate(new Date(Date.now() - 1000).toISOString())
    expect(result).toBe('just now')
  })
})

describe('basename', () => {
  it('returns the filename from a path', () => {
    expect(basename('src/components/Toolbar.tsx')).toBe('Toolbar.tsx')
  })
  it('returns the value unchanged if no slash', () => {
    expect(basename('main.go')).toBe('main.go')
  })
  it('handles trailing slash gracefully', () => {
    expect(basename('src/')).toBe('')
  })
})
