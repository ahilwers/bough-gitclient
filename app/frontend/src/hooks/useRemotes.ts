import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListRemotes, AddRemote, UpdateRemote, RenameRemote, RemoveRemote } from '@wailsjs/go/main/App'
import type { Remote } from '@/lib/types'

export function useRemotes() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['remotes'],
    queryFn: async () => (await ListRemotes()) as Remote[],
    staleTime: 30_000,
  })

  const addMutation = useMutation({
    mutationFn: ({ name, url }: { name: string; url: string }) => AddRemote(name, url),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remotes'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ name, url }: { name: string; url: string }) => UpdateRemote(name, url),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remotes'] }),
  })

  const renameMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      RenameRemote(oldName, newName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remotes'] }),
  })

  const removeMutation = useMutation({
    mutationFn: (name: string) => RemoveRemote(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remotes'] }),
  })

  return { ...query, addMutation, updateMutation, renameMutation, removeMutation }
}
