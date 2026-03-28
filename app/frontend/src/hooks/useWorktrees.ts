import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListWorktrees, AddWorktree as AddWorktreeAPI } from '@wailsjs/go/main/App'
import type { WorktreeInfo } from '@/lib/types'

export function useWorktrees() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['worktrees'],
    queryFn: async () => (await ListWorktrees()) as WorktreeInfo[],
    staleTime: 30_000,
  })

  const addMutation = useMutation({
    mutationFn: ({ path, branch }: { path: string; branch: string }) =>
      AddWorktreeAPI(path, branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] })
    },
  })

  return { ...query, addMutation }
}
