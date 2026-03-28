import { describe, it, expect } from 'vitest'
import { shortHash, formatRelativeDate, maskLicenseKey, basename, parseGitError } from './format'

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

describe('parseGitError', () => {
  it('extracts the fatal: line from a typical git worktree error', () => {
    const raw = new Error(
      "git [worktree add ../gitclient-worktree main]: exit status 128\n" +
      "Preparing worktree (checking out 'main')\n" +
      "fatal: 'main' is already used by worktree at '/Users/user/repo'\n"
    )
    expect(parseGitError(raw)).toBe("'main' is already used by worktree at '/Users/user/repo'")
  })

  it('extracts the error: line', () => {
    const raw = new Error(
      "git [push origin main]: exit status 1\n" +
      "error: failed to push some refs to 'origin'\n"
    )
    expect(parseGitError(raw)).toBe("failed to push some refs to 'origin'")
  })

  it('joins multiple fatal/error lines', () => {
    const raw = new Error(
      "git [merge feature]: exit status 1\n" +
      "error: Your local changes would be overwritten by merge.\n" +
      "error: Please commit or stash them.\n"
    )
    expect(parseGitError(raw)).toBe(
      "Your local changes would be overwritten by merge.\nPlease commit or stash them."
    )
  })

  it('strips the command prefix when there is no fatal/error line', () => {
    const raw = new Error(
      "git [status --porcelain=v1]: exit status 1\nsome unexpected output"
    )
    expect(parseGitError(raw)).toBe('some unexpected output')
  })

  it('handles plain Error with no git prefix', () => {
    expect(parseGitError(new Error('no repository open'))).toBe('no repository open')
  })

  it('handles a non-Error value', () => {
    expect(parseGitError('something went wrong')).toBe('something went wrong')
  })

  it('is case-insensitive for the prefix keywords', () => {
    const raw = new Error("Fatal: not a git repo")
    expect(parseGitError(raw)).toBe('not a git repo')
  })
})
