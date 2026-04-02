import { useQuery } from '@tanstack/react-query'
import { GetStashDiff } from '@wailsjs/go/main/App'
import type { DiffFile } from '@/lib/types'

export function useStashDiff(index: number | null) {
  return useQuery({
    queryKey: ['stashDiff', index],
    queryFn: async () => (await GetStashDiff(index!)) as DiffFile[],
    enabled: index !== null,
    staleTime: 30_000,
  })
}
