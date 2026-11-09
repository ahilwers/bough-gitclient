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

import { Button } from '../shared/Button'
import { useEffect, useRef, useState } from 'react'
import { GitBranch, X } from 'lucide-react'
import { GetAppVersion } from '@bindings/gitmorrow/app'
import { useGitStore } from '@/stores/gitStore'

/** Renders the embedded build version ("dev" outside release builds). */
function formatVersion(version: string | null): string {
  if (!version) return '…'
  return version === 'dev' ? 'Development build' : version.replace(/^v/, '')
}

/**
 * About dialog opened from the native menu ("About GitMorrow"). It is an in-app
 * dialog rather than the platform about panel because only this can show the
 * build version returned by the Go backend.
 */
export function AboutDialog() {
  const { aboutDialogOpen, setAboutDialogOpen } = useGitStore()
  const [version, setVersion] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aboutDialogOpen) return
    let cancelled = false
    GetAppVersion()
      .then(v => { if (!cancelled) setVersion(v) })
      .catch(() => { if (!cancelled) setVersion('dev') })
    return () => { cancelled = true }
  }, [aboutDialogOpen])

  useEffect(() => {
    if (!aboutDialogOpen) return
    closeRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setAboutDialogOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [aboutDialogOpen, setAboutDialogOpen])

  if (!aboutDialogOpen) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={() => setAboutDialogOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About GitMorrow"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          width: 380,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-sub)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sec)' }}>About</span>
          <Button variant="icon" aria-label="Close about dialog"
            ref={closeRef}
            onClick={() => setAboutDialogOpen(false)}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: 'none', background: 'transparent',
              color: 'var(--text-ter)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} />
          </Button>
        </div>

        {/* Body */}
        <div style={{
          padding: '24px 24px 20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--acc-soft)', marginBottom: 6,
          }}>
            <GitBranch size={26} strokeWidth={1.8} style={{ color: 'var(--acc)' }} />
          </div>

          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-pri)', letterSpacing: '-0.01em' }}>
            GitMorrow
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sec)', textAlign: 'center' }}>
            The Git Client Of Tomorrow
          </div>

          <div style={{
            marginTop: 10, padding: '5px 10px',
            borderRadius: 6, background: 'var(--bg-content)',
            border: '1px solid var(--border-sub)',
            fontSize: 11, fontFamily: 'monospace', color: 'var(--text-pri)',
          }}>
            Version <span data-testid="about-version">{formatVersion(version)}</span>
          </div>

          <div style={{
            marginTop: 14, fontSize: 11, color: 'var(--text-ter)',
            textAlign: 'center', lineHeight: 1.5,
          }}>
            Free software under the GNU GPL v3 or later.
            <br />
            Your repositories stay on your machine.
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '0 20px 18px',
          display: 'flex', justifyContent: 'center',
        }}>
          <Button variant="secondary" onClick={() => setAboutDialogOpen(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
