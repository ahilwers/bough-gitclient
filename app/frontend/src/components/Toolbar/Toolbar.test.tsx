import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GetStatus } from '@wailsjs/go/main/App'
import { useGitStore } from '@/stores/gitStore'
import Toolbar from './Toolbar'

const status = { branch: 'feature/current-branch', ahead: 0, behind: 0, files: [], hasConflicts: false }

function renderToolbar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={queryClient}><Toolbar /></QueryClientProvider>)
  return queryClient
}

describe('current branch indicator', () => {
  beforeEach(() => {
    vi.mocked(GetStatus).mockReset().mockResolvedValue(status)
    useGitStore.setState({ activeView: 'changes', activeRepo: '/repo', recentRepos: [], helpDialogOpen: false })
  })

  afterEach(() => cleanup())

  it('shows the checked-out branch in Changes with the full name in its tooltip', async () => {
    const branch = `feature/${'a-long-branch-name-'.repeat(10)}`
    vi.mocked(GetStatus).mockResolvedValue({ ...status, branch })
    renderToolbar()

    const indicator = await screen.findByRole('status', { name: `Current branch: ${branch}` })
    expect(indicator).toHaveTextContent(branch)
    expect(indicator).toHaveAttribute('title', `Current branch: ${branch}`)
    expect(indicator.querySelector('span')).toHaveStyle({ textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
  })

  it('updates when repository status is refreshed after checkout or a worktree switch', async () => {
    const queryClient = renderToolbar()
    await screen.findByRole('status', { name: 'Current branch: feature/current-branch' })

    vi.mocked(GetStatus).mockResolvedValue({ ...status, branch: 'main' })
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['status'] }) })

    expect(await screen.findByRole('status', { name: 'Current branch: main' })).toHaveTextContent('main')
    expect(screen.queryByText(status.branch)).not.toBeInTheDocument()
  })

  it('explicitly labels detached HEAD instead of presenting HEAD as a branch', async () => {
    vi.mocked(GetStatus).mockResolvedValue({ ...status, branch: 'HEAD' })
    renderToolbar()

    expect(await screen.findByRole('status', { name: 'Detached HEAD' })).toHaveTextContent('Detached HEAD')
    expect(screen.queryByRole('status', { name: 'Current branch: HEAD' })).not.toBeInTheDocument()
  })

  it('does not display cached branch data when no repository is active', async () => {
    useGitStore.setState({ activeRepo: null })
    const queryClient = renderToolbar()
    await act(async () => { await queryClient.ensureQueryData({ queryKey: ['status'] }) })
    expect(queryClient.getQueryData(['status'])).toEqual(status)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not guess a branch while status is loading', () => {
    vi.mocked(GetStatus).mockReturnValue(new Promise(() => {}))
    renderToolbar()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('Detached HEAD')).not.toBeInTheDocument()
  })

  it('omits the indicator when the backend cannot determine the branch', async () => {
    vi.mocked(GetStatus).mockResolvedValue({ ...status, branch: '' })
    const queryClient = renderToolbar()
    await act(async () => { await queryClient.ensureQueryData({ queryKey: ['status'] }) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
