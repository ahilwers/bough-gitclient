import { useQuery } from '@tanstack/react-query'
import { GetFileAtCommit, GetFileAtCommitParent } from '@wailsjs/go/main/App'

/**
 * Returns the file content at a commit and at its first parent.
 * Both queries are disabled when hash or filePath is null/empty.
 */
export function useFileAtCommit(hash: string | null, filePath: string | null) {
  const enabled = !!(hash && filePath)

  const current = useQuery({
    queryKey: ['file-at-commit', hash, filePath],
    queryFn: async () => {
      const result = await GetFileAtCommit(hash!, filePath!)
      return result ?? ''
    },
    enabled,
    staleTime: Infinity,
  })

  const parent = useQuery({
    queryKey: ['file-at-parent', hash, filePath],
    queryFn: async () => {
      const result = await GetFileAtCommitParent(hash!, filePath!)
      return result ?? ''
    },
    enabled,
    staleTime: Infinity,
  })

  return { current, parent }
}
