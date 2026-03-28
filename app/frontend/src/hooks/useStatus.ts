import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetStatus } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import type { RepoStatus } from '@/lib/types'

export function useStatus() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['status'],
    queryFn: async () => (await GetStatus()) as RepoStatus,
    staleTime: 10_000,
  })

  useEffect(() => {
    const unsubscribe = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['status'] })
    })
    return unsubscribe
  }, [queryClient])

  return query
}
