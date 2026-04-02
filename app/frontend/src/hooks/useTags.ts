import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListTags, CheckoutTag, DeleteTag } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import type { Tag } from '@/lib/types'

export function useTags() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await ListTags()) as Tag[],
    staleTime: 30_000,
  })

  useEffect(() => {
    const unsub = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [queryClient])

  const checkoutMutation = useMutation({
    mutationFn: (tag: string) => CheckoutTag(tag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['commits'] })
      queryClient.invalidateQueries({ queryKey: ['branches'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (tag: string) => DeleteTag(tag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['commits'] })
    },
  })

  return { ...query, checkoutMutation, deleteMutation }
}
