import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateCommit, Fetch, Pull, Push } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import { useGitStore } from '@/stores/gitStore'
import App from './App'

// Keep the application shell and write controls real while isolating unrelated views.
vi.mock('@/components/Sidebar/Sidebar', () => ({ default: () => null }))
vi.mock('@/components/HistoryView/HistoryView', () => ({ default: () => <div>History view</div> }))
vi.mock('@/components/ChangesView/ChangesView', async () => {
  const { CommitBox } = await import('@/components/ChangesView/CommitBox')
  return { default: () => <CommitBox /> }
})
vi.mock('@/components/shared/CommandPalette', () => ({ default: () => null }))

describe('unrestricted application access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGitStore.setState({ activeView: 'history', activeRepo: '/repo', recentRepos: [], flash: null })
  })

  afterEach(() => cleanup())

  it('starts without license APIs or revocation subscriptions and permits Git writes', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>)

    expect(screen.getByText('History view')).toBeInTheDocument()
    expect(vi.mocked(EventsOn).mock.calls.map(([event]) => event)).not.toContain('license:revoked')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Fetch' }))
    await waitFor(() => expect(Fetch).toHaveBeenCalledWith(''))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pull' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Pull' }))
    await waitFor(() => expect(Pull).toHaveBeenCalledWith('', ''))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Push' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Push' }))
    await waitFor(() => expect(Push).toHaveBeenCalledWith('', '', false))

    fireEvent.click(screen.getByRole('button', { name: 'Changes' }))
    fireEvent.change(screen.getByPlaceholderText('Describe your changes…'), { target: { value: 'Test commit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }))
    await waitFor(() => expect(CreateCommit).toHaveBeenCalledWith('Test commit'))
  })
})
