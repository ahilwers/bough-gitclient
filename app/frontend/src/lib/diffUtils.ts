import type { DiffHunk } from './types'

/**
 * buildHunkPatch constructs a minimal unified diff patch for a single hunk,
 * suitable for `git apply --cached` (stage) or `git apply -R` (discard).
 */
export function buildHunkPatch(filePath: string, hunk: DiffHunk): string {
  const lines: string[] = []
  lines.push(`--- a/${filePath}`)
  lines.push(`+++ b/${filePath}`)
  lines.push(hunk.header)
  for (const line of hunk.lines) {
    if (line.type === 'add') lines.push(`+${line.content}`)
    else if (line.type === 'del') lines.push(`-${line.content}`)
    else lines.push(` ${line.content}`)
  }
  return lines.join('\n') + '\n'
}
