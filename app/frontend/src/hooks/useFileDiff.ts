import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetFileDiff, GetUntrackedFileDiff } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import type { DiffFile } from '@/lib/types'

export function useFileDiff(filePath: string | null, staged: boolean, isUntracked = false) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['diff', filePath, staged, isUntracked],
    queryFn: async (): Promise<DiffFile> => {
      if (isUntracked) {
        return (await GetUntrackedFileDiff(filePath!)) as DiffFile
      }
      return (await GetFileDiff(filePath!, staged)) as DiffFile
    },
    enabled: filePath !== null,
    staleTime: 5_000,
  })

  useEffect(() => {
    const unsubscribe = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['diff'] })
    })
    return unsubscribe
  }, [queryClient])

  return query
}
