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
 * Masks all but the first two segments of a Bough license key.
 * e.g. "BOUGH-A3F2K-XMPL9-QZ7RT-4WJHB" → "BOUGH-A3F2K-****-****-****"
 */
export function maskLicenseKey(key: string): string {
  const parts = key.split('-')
  if (parts.length < 3) return key
  return [parts[0], parts[1], ...parts.slice(2).map(() => '****')].join('-')
}

/**
 * Returns the last component of a file path (the filename).
 */
export function basename(path: string): string {
  return path.split('/').pop() ?? path
}
