import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { GetMergeCommits } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import type { CommitNode } from '@/lib/types'

export function useMergeCommits(enabled: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['mergeCommits'] })
    })
    return unsubscribe
  }, [queryClient])

  return useQuery({
    queryKey: ['mergeCommits'],
    queryFn: async () => ((await GetMergeCommits()) ?? []) as CommitNode[],
    enabled,
    staleTime: 5_000,
  })
}
