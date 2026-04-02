import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListStashes, ApplyStash, PopStash, DropStash } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import type { StashEntry } from '@/lib/types'

export function useStashes() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['stashes'],
    queryFn: async () => (await ListStashes()) as StashEntry[],
    staleTime: 30_000,
  })

  useEffect(() => {
    const unsub = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['stashes'] })
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [queryClient])

  const invalidateAfterApply = () => {
    queryClient.invalidateQueries({ queryKey: ['stashes'] })
    queryClient.invalidateQueries({ queryKey: ['status'] })
  }

  const applyMutation = useMutation({
    mutationFn: (index: number) => ApplyStash(index),
    onSuccess: invalidateAfterApply,
  })

  const popMutation = useMutation({
    mutationFn: (index: number) => PopStash(index),
    onSuccess: invalidateAfterApply,
  })

  const dropMutation = useMutation({
    mutationFn: (index: number) => DropStash(index),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stashes'] }),
  })

  return { ...query, applyMutation, popMutation, dropMutation }
}
