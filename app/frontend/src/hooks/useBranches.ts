import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListBranches, CheckoutBranch, CheckoutRemoteBranch, PullIntoLocalBranch, Pull } from '@wailsjs/go/main/App'
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

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['branches'] })
    queryClient.invalidateQueries({ queryKey: ['commits'] })
    queryClient.invalidateQueries({ queryKey: ['status'] })
  }

  const checkoutMutation = useMutation({
    mutationFn: (branch: string) => CheckoutBranch(branch),
    onSuccess: invalidateAll,
  })

  const checkoutRemoteMutation = useMutation({
    mutationFn: (remoteBranch: string) => CheckoutRemoteBranch(remoteBranch),
    onSuccess: invalidateAll,
  })

  const pullIntoLocalMutation = useMutation({
    mutationFn: ({ remote, localBranch }: { remote: string; localBranch: string }) =>
      PullIntoLocalBranch(remote, localBranch),
    onSuccess: invalidateAll,
  })

  const pullIntoCurrentMutation = useMutation({
    mutationFn: ({ remote, branch }: { remote: string; branch: string }) =>
      Pull(remote, branch),
    onSuccess: invalidateAll,
  })

  return { ...query, checkoutMutation, checkoutRemoteMutation, pullIntoLocalMutation, pullIntoCurrentMutation }
}
