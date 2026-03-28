import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetCommits } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import type { CommitNode } from '@/lib/types'

export function useCommits(limit = 500) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['commits', limit],
    queryFn: async () => {
      const result = await GetCommits(limit)
      return (result || []) as CommitNode[]
    },
    staleTime: 30_000,
  })

  // Invalidate when the repo changes on disk (watcher fires 'repo:changed')
  useEffect(() => {
    const unsubscribe = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['commits'] })
    })
    return unsubscribe
  }, [queryClient])

  return query
}
