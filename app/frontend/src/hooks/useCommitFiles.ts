import { useQuery } from '@tanstack/react-query'
import { GetCommitDiff } from '@wailsjs/go/main/App'
import type { DiffFile } from '@/lib/types'

/** Returns the list of files changed in a commit (wraps GetCommitDiff). */
export function useCommitFiles(hash: string | null) {
  return useQuery({
    queryKey: ['commit-files', hash],
    queryFn: async () => {
      const result = await GetCommitDiff(hash!)
      return (result || []) as DiffFile[]
    },
    enabled: !!hash,
    staleTime: Infinity, // commit history is immutable
  })
}
