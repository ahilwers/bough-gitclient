// Copyright (C) 2026 Achim Hilwers
//
// This file is part of Bough.
//
// Bough is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
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
})
