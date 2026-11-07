/**
 * Returns the first 7 characters of a git hash.
 * If the string is shorter than 7 chars it is returned as-is.
 */
export function shortHash(hash: string): string {
  return hash.length > 7 ? hash.slice(0, 7) : hash
}

/**
 * Formats a date as a human-readable relative string (e.g. "3 days ago").
 * Falls back to locale date string for dates older than a year.
 */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diff = now - d.getTime()

  const minute = 60_000
  const hour   = 60 * minute
  const day    = 24 * hour
  const week   = 7  * day
  const month  = 30 * day
  const year   = 365 * day

  if (diff < minute)      return 'just now'
  if (diff < hour)        return `${Math.floor(diff / minute)} min ago`
  if (diff < day)         return `${Math.floor(diff / hour)} hours ago`
  if (diff < week)        return `${Math.floor(diff / day)} days ago`
  if (diff < month)       return `${Math.floor(diff / week)} weeks ago`
  if (diff < year)        return `${Math.floor(diff / month)} months ago`
  return d.toLocaleDateString()
}

/**
 * Returns the last component of a file path (the filename).
 */
export function basename(path: string): string {
  return path.split('/').pop() ?? path
}

/**
 * Extracts a human-readable message from a raw git CLI error.
 *
 * Wails surfaces Go errors as rejected Promises whose message looks like:
 *   "git [worktree add ...]: exit status 128\nPreparing worktree...\nfatal: 'main' is already used by worktree at '...'"
 *
 * This function strips the command prefix and boilerplate, returning only the
 * meaningful git diagnostic line(s) (fatal:, error:, hint:).
 * Falls back to the trimmed original message when no such lines are found.
 */
export function parseGitError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)

  // Extract lines that carry the actual diagnostic from git.
  const diagnosticLines = raw
    .split('\n')
    .filter(l => /^(fatal|error|hint):\s*/i.test(l))
    .map(l => l.replace(/^(fatal|error|hint):\s*/i, '').trim())
    .filter(Boolean)

  if (diagnosticLines.length > 0) {
    return diagnosticLines.join('\n')
  }

  // Strip the "git [...]: exit status N" prefix that the Go CLI wrapper adds.
  const withoutPrefix = raw.replace(/^git \[.*?\]: exit status \d+\s*/m, '').trim()
  return withoutPrefix || raw.trim()
}
