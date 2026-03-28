import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ListBranches } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import type { BranchList } from '@/lib/types'

export function useBranches() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await ListBranches()) as BranchList,
    staleTime: 30_000,
  })

  useEffect(() => {
    const unsubscribe = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
    })
    return unsubscribe
  }, [queryClient])

  return query
}
