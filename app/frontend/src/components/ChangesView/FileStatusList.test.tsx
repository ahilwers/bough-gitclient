import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FileStatus, RepoStatus } from '@/lib/types'
import { FileStatusList } from './FileStatusList'

afterEach(() => cleanup())

const files: FileStatus[] = Array.from({ length: 20 }, (_, i) => ({
  // Exercise paths that cannot safely be interpolated into a CSS selector.
  path: `src/file [${i}] "quoted".ts`, oldPath: '', staged: 'M', unstaged: 'M', added: 1, deleted: 1,
}))

function setup(initialPath: string | null = files[0].path, initialStaged = false, entries = files) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const status: RepoStatus = { branch: 'main', ahead: 0, behind: 0, files: entries, hasConflicts: false }
  queryClient.setQueryData(['status'], status)
  const onSelect = vi.fn()

  function Harness() {
    const [selected, setSelected] = useState({ path: initialPath, staged: initialStaged })
    return <FileStatusList selectedFile={selected.path} selectedStaged={selected.staged}
      onSelectFile={(file, staged) => {
        onSelect(file, staged)
        setSelected({ path: file.path, staged })
      }} />
  }

  const { container } = render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>)
  const panel = container.querySelector<HTMLElement>('[data-panel="changes-filelist"]')!
  const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-file-path]'))
  const row = (path: string, staged = false) => rows.find(el => el.dataset.filePath === path && el.dataset.staged === String(staged))!
  const unstaged = row(entries[0].path).parentElement!
  const staged = rows.find(el => el.dataset.staged === 'true')?.parentElement

  // jsdom has no layout. Model two independently scrolling, three-row viewports.
  // Rows report their current position so repeated key presses test real visibility.
  for (const list of new Set(rows.map(el => el.parentElement!))) {
    const top = list === staged ? 400 : 100
    Object.defineProperty(list, 'clientHeight', { value: 90 })
    vi.spyOn(list, 'getBoundingClientRect').mockImplementation(() => ({ top, bottom: top + 90 }) as DOMRect)
    Array.from(list.children).forEach((el, index) => {
      vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => ({
        top: top + index * 30 - list.scrollTop,
        bottom: top + (index + 1) * 30 - list.scrollTop,
      }) as DOMRect)
    })
  }
  act(() => panel.focus())
  const key = (key: string) => fireEvent.keyDown(panel, { key })
  return { panel, row, unstaged, staged: staged!, key, onSelect, queryClient, status }
}

describe('Changes file list keyboard scrolling', () => {
  it.each([false, true])('minimally reveals rows above and below the viewport (staged=%s)', selectedStaged => {
    const { panel, key, unstaged, staged, onSelect } = setup(files[0].path, selectedStaged)
    const list = selectedStaged ? staged : unstaged
    const otherList = selectedStaged ? unstaged : staged
    key('ArrowDown')
    key('ArrowDown')
    expect(list.scrollTop).toBe(0) // Fully visible rows do not jump.
    key('ArrowDown')
    expect(onSelect).toHaveBeenLastCalledWith(files[3], selectedStaged)
    expect(list.scrollTop).toBe(30)
    key('j')
    expect(list.scrollTop).toBe(60)
    key('ArrowUp')
    key('k')
    expect(list.scrollTop).toBe(60)
    key('ArrowUp')
    expect(onSelect).toHaveBeenLastCalledWith(files[1], selectedStaged)
    expect(list.scrollTop).toBe(30)
    expect(otherList.scrollTop).toBe(0)
    expect(panel).toHaveFocus()
  })

  it('handles first/last boundaries and reveals an already-selected row after manual scrolling', () => {
    const { key, unstaged, staged, onSelect } = setup()
    key('ArrowUp')
    expect(onSelect).toHaveBeenLastCalledWith(files[0], false)
    expect(unstaged.scrollTop).toBe(0)
    key('G')
    expect(onSelect).toHaveBeenLastCalledWith(files[19], true)
    expect(staged.scrollTop).toBe(510)
    key('ArrowDown')
    expect(staged.scrollTop).toBe(510)
    staged.scrollTop = 0
    key('ArrowDown')
    expect(staged.scrollTop).toBe(510)
  })

  it('scrolls the correct section when the same path is both staged and unstaged', () => {
    const { key, unstaged, staged, onSelect, panel } = setup(files[19].path)
    unstaged.scrollTop = 510
    staged.scrollTop = 300
    key('ArrowDown')
    expect(onSelect).toHaveBeenLastCalledWith(files[0], true)
    expect(staged.scrollTop).toBe(0)
    expect(unstaged.scrollTop).toBe(510)
    key('ArrowUp')
    expect(onSelect).toHaveBeenLastCalledWith(files[19], false)
    expect(unstaged.scrollTop).toBe(510)
    key(']')
    expect(onSelect).toHaveBeenLastCalledWith(files[0], true)
    key('[')
    expect(onSelect).toHaveBeenLastCalledWith(files[0], false)
    expect(unstaged.scrollTop).toBe(0)
    expect(panel).toHaveFocus()
  })

  it('does not scroll on mouse selection or background status refresh', () => {
    const { row, key, unstaged, queryClient, status } = setup()
    fireEvent.click(row(files[10].path))
    expect(unstaged.scrollTop).toBe(0)
    act(() => queryClient.setQueryData(['status'], { ...status, files: [...status.files] }))
    expect(unstaged.scrollTop).toBe(0)
    key('ArrowDown')
    expect(unstaged.scrollTop).toBe(270)
  })

  it('reveals partially clipped rows rather than leaving their bottom hidden', () => {
    const { row, key, unstaged } = setup()
    vi.spyOn(row(files[1].path), 'getBoundingClientRect').mockReturnValue({ top: 175, bottom: 205 } as DOMRect)
    key('ArrowDown')
    expect(unstaged.scrollTop).toBe(15)
  })

  it('selects the first file from no selection and tolerates an empty list', () => {
    const first = setup(null)
    first.key('ArrowDown')
    expect(first.onSelect).toHaveBeenLastCalledWith(files[0], false)
    cleanup()
    const queryClient = new QueryClient()
    queryClient.setQueryData(['status'], { ...first.status, files: [] })
    const onSelect = vi.fn()
    const { container } = render(<QueryClientProvider client={queryClient}>
      <FileStatusList selectedFile={null} selectedStaged={false} onSelectFile={onSelect} />
    </QueryClientProvider>)
    const panel = container.querySelector<HTMLElement>('[data-panel="changes-filelist"]')!
    for (const key of ['ArrowDown', 'ArrowUp', 'j', 'k', 'G', '[', ']']) fireEvent.keyDown(panel, { key })
    expect(onSelect).not.toHaveBeenCalled()
  })
})
