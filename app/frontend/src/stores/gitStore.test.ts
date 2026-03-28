import { describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { useGitStore } from './gitStore'

beforeEach(() => {
  // Reset store to initial state between tests
  useGitStore.setState({
    activeView: 'history',
    showSidebar: true,
    flash: null,
    activeRepo: null,
    recentRepos: [],
    worktrees: [],
    activeWorktree: null,
    selectedCommit: null,
    selectedFile: null,
  })
})

describe('theme', () => {
  it('toggleTheme switches between light and dark', () => {
    useGitStore.setState({ theme: 'light' })
    act(() => useGitStore.getState().toggleTheme())
    expect(useGitStore.getState().theme).toBe('dark')

    act(() => useGitStore.getState().toggleTheme())
    expect(useGitStore.getState().theme).toBe('light')
  })

  it('setTheme sets an explicit value', () => {
    act(() => useGitStore.getState().setTheme('dark'))
    expect(useGitStore.getState().theme).toBe('dark')
  })
})

describe('view', () => {
  it('setView updates activeView', () => {
    act(() => useGitStore.getState().setView('changes'))
    expect(useGitStore.getState().activeView).toBe('changes')
  })
})

describe('selectedCommit', () => {
  it('updates when setSelectedCommit is called', () => {
    act(() => useGitStore.getState().setSelectedCommit('abc1234'))
    expect(useGitStore.getState().selectedCommit).toBe('abc1234')
  })

  it('clears selectedFile when commit changes', () => {
    act(() => {
      useGitStore.getState().setSelectedFile('src/main.go')
      useGitStore.getState().setSelectedCommit('new-hash')
    })
    expect(useGitStore.getState().selectedFile).toBeNull()
  })

  it('can be cleared by passing null', () => {
    act(() => useGitStore.getState().setSelectedCommit('abc1234'))
    act(() => useGitStore.getState().setSelectedCommit(null))
    expect(useGitStore.getState().selectedCommit).toBeNull()
  })
})

describe('selectedFile', () => {
  it('updates when setSelectedFile is called', () => {
    act(() => useGitStore.getState().setSelectedFile('src/main.tsx'))
    expect(useGitStore.getState().selectedFile).toBe('src/main.tsx')
  })

  it('does NOT clear selectedCommit when file changes', () => {
    act(() => useGitStore.getState().setSelectedCommit('hash123'))
    act(() => useGitStore.getState().setSelectedFile('README.md'))
    expect(useGitStore.getState().selectedCommit).toBe('hash123')
  })
})

describe('activeRepo', () => {
  it('setActiveRepo updates activeRepo and prepends to recentRepos', () => {
    act(() => useGitStore.getState().setActiveRepo('/path/to/repo'))
    expect(useGitStore.getState().activeRepo).toBe('/path/to/repo')
    expect(useGitStore.getState().recentRepos[0]).toBe('/path/to/repo')
  })

  it('does not duplicate repos in recentRepos', () => {
    act(() => {
      useGitStore.getState().setActiveRepo('/path/a')
      useGitStore.getState().setActiveRepo('/path/b')
      useGitStore.getState().setActiveRepo('/path/a')
    })
    const recent = useGitStore.getState().recentRepos
    expect(recent[0]).toBe('/path/a')
    expect(recent.filter(r => r === '/path/a').length).toBe(1)
  })

  it('caps recentRepos at 10 entries', () => {
    act(() => {
      for (let i = 0; i < 15; i++) {
        useGitStore.getState().setActiveRepo(`/repo/${i}`)
      }
    })
    expect(useGitStore.getState().recentRepos.length).toBe(10)
  })
})

describe('showSidebar', () => {
  it('defaults to true', () => {
    expect(useGitStore.getState().showSidebar).toBe(true)
  })

  it('setShowSidebar toggles visibility', () => {
    act(() => useGitStore.getState().setShowSidebar(false))
    expect(useGitStore.getState().showSidebar).toBe(false)
    act(() => useGitStore.getState().setShowSidebar(true))
    expect(useGitStore.getState().showSidebar).toBe(true)
  })
})

describe('setActiveView', () => {
  it('is an alias for setView', () => {
    act(() => useGitStore.getState().setActiveView('changes'))
    expect(useGitStore.getState().activeView).toBe('changes')
  })
})

describe('flash', () => {
  it('showFlash sets the flash message', () => {
    act(() => useGitStore.getState().showFlash('Committed!'))
    const flash = useGitStore.getState().flash
    expect(flash?.message).toBe('Committed!')
    expect(flash?.type).toBe('success') // default type
  })

  it('showFlash accepts an explicit type', () => {
    act(() => useGitStore.getState().showFlash('Error occurred', 'danger'))
    expect(useGitStore.getState().flash?.type).toBe('danger')
  })

  it('clearFlash removes the message', () => {
    act(() => useGitStore.getState().showFlash('hello'))
    act(() => useGitStore.getState().clearFlash())
    expect(useGitStore.getState().flash).toBeNull()
  })
})
