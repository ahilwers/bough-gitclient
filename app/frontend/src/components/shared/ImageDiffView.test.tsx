// Copyright (C) 2026 Achim Hilwers
//
// This file is part of GitMorrow.
//
// GitMorrow is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { ImageDiffView } from './ImageDiffView'

// Minimal ResizeObserver polyfill — jsdom does not implement it.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const png1 = { dataURL: 'data:image/png;base64,AAAA', size: 1280 }
const png2 = { dataURL: 'data:image/png;base64,BBBB', size: 2560 }

describe('ImageDiffView', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders both images side by side with labels and metadata', () => {
    const { container } = render(<ImageDiffView left={png1} right={png2} leftLabel="Parent" rightLabel="Commit" />)

    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
    expect(imgs[0]).toHaveAttribute('src', png1.dataURL)
    expect(imgs[1]).toHaveAttribute('src', png2.dataURL)

    expect(screen.getByText('Parent')).toBeInTheDocument()
    expect(screen.getByText('Commit')).toBeInTheDocument()

    // Byte sizes are shown with human-friendly labels.
    expect(screen.getByText('1.3 KB')).toBeInTheDocument()
    expect(screen.getByText('2.5 KB')).toBeInTheDocument()
  })

  it('shows a placeholder and no image when one side is missing', () => {
    const { container } = render(
      <ImageDiffView
        left={null}
        right={png1}
        leftLabel="Parent"
        rightLabel="Commit"
        leftEmptyHint="No parent version"
      />
    )

    expect(screen.getByText('No parent version')).toBeInTheDocument()
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(screen.getByText('1.3 KB')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(1)
  })

  it('shows image dimensions once the image has loaded', () => {
    const { container } = render(<ImageDiffView left={png1} right={null} leftLabel="Ours" rightLabel="Theirs" />)

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    Object.defineProperty(img as HTMLImageElement, 'naturalWidth', { value: 100, configurable: true })
    Object.defineProperty(img as HTMLImageElement, 'naturalHeight', { value: 50, configurable: true })
    fireEvent.load(img as HTMLImageElement)

    expect(screen.getByText('100 × 50 px')).toBeInTheDocument()
  })

  it('shows a loading overlay while queries are pending and no side has data', () => {
    render(
      <ImageDiffView left={undefined} right={undefined} leftLabel="A" rightLabel="B" loading />
    )
    expect(screen.getByText('Loading images…')).toBeInTheDocument()
  })

  it('displays the new image when its load event fires before React flushes effects', async () => {
    // Regression test: switching a commit while already on the Diff tab swaps
    // the image src on an already-mounted <img>. The browser can fire `load`
    // for the new (cached) image before React runs passive effects, and the
    // new image would stay hidden forever. The dims reset must therefore
    // happen during render, with the onLoad handler always attached.
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    // Initial render with image A; simulate the browser loading it.
    act(() => {
      root.render(<ImageDiffView left={png1} right={null} leftLabel="Parent" rightLabel="Commit" />)
    })
    const img = container.querySelector('img')!
    Object.defineProperty(img, 'naturalWidth', { value: 100, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 50, configurable: true })
    act(() => {
      fireEvent.load(img)
    })
    expect(screen.getByText('100 × 50 px')).toBeInTheDocument()

    // Swap to image B. flushSync commits the new src synchronously but leaves
    // React's passive effects pending — like selecting a new commit on the
    // Diff tab when its image data is already cached.
    flushSync(() => {
      root.render(<ImageDiffView left={png2} right={null} leftLabel="Parent" rightLabel="Commit" />)
    })
    const img2 = container.querySelector('img')!
    expect(img2).toBe(img) // same <img> element, only the src changed

    // The browser fires `load` for the new src before React runs the reset
    // effect — this is the race that used to leave the image hidden.
    Object.defineProperty(img2, 'naturalWidth', { value: 200, configurable: true })
    Object.defineProperty(img2, 'naturalHeight', { value: 100, configurable: true })
    fireEvent.load(img2)

    // Flush React's pending passive effects.
    await act(async () => {})

    // The new image must be measured and visible.
    expect(screen.getByText('200 × 100 px')).toBeInTheDocument()
    expect(img2.style.visibility).toBe('visible')

    container.remove()
  })
})
