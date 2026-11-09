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
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Plus, Pencil, Trash2, Check, AlertCircle } from 'lucide-react'
import { useRemotes } from '@/hooks/useRemotes'
import { useGitStore } from '@/stores/gitStore'
import { parseGitError } from '@/lib/format'
import type { Remote } from '@/lib/types'

interface Props {
  onClose: () => void
}

export function ManageRemotesDialog({ onClose }: Props) {
  const { data: remotes = [], addMutation, updateMutation, renameMutation, removeMutation } = useRemotes()
  const showFlash = useGitStore(s => s.showFlash)

  // Which remote is being edited (by name), or null
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editURL, setEditURL] = useState('')
  const [editError, setEditError] = useState('')

  // Add-new form state
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newURL, setNewURL] = useState('')
  const [addError, setAddError] = useState('')

  // Pending delete confirmation
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const startEdit = (remote: Remote) => {
    setEditingName(remote.name)
    setEditName(remote.name)
    setEditURL(remote.fetchURL)
    setEditError('')
    setAdding(false)
  }

  const cancelEdit = () => {
    setEditingName(null)
    setEditError('')
  }

  const saveEdit = async () => {
    if (!editName.trim()) { setEditError('Name is required'); return }
    if (!editURL.trim()) { setEditError('URL is required'); return }
    setEditError('')

    try {
      // If the name changed, rename first, then update URL
      if (editName.trim() !== editingName) {
        await renameMutation.mutateAsync({ oldName: editingName!, newName: editName.trim() })
        await updateMutation.mutateAsync({ name: editName.trim(), url: editURL.trim() })
      } else {
        await updateMutation.mutateAsync({ name: editName.trim(), url: editURL.trim() })
      }
      setEditingName(null)
      showFlash('Remote updated', 'success')
    } catch (err) {
      setEditError(parseGitError(err))
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await removeMutation.mutateAsync(pendingDelete)
      setPendingDelete(null)
      showFlash('Remote removed', 'success')
    } catch (err) {
      showFlash(parseGitError(err), 'danger')
      setPendingDelete(null)
    }
  }

  const saveAdd = async () => {
    if (!newName.trim()) { setAddError('Name is required'); return }
    if (!newURL.trim()) { setAddError('URL is required'); return }
    setAddError('')
    try {
      await addMutation.mutateAsync({ name: newName.trim(), url: newURL.trim() })
      setNewName('')
      setNewURL('')
      setAdding(false)
      showFlash('Remote added', 'success')
    } catch (err) {
      setAddError(parseGitError(err))
    }
  }

  const inputStyle = (hasError: boolean) => ({
    width: '100%',
    padding: '6px 10px',
    borderRadius: 6,
    border: `1px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
    background: 'var(--bg-content)',
    color: 'var(--text-pri)',
    fontSize: 13,
    fontFamily: 'monospace',
    outline: 'none',
    boxSizing: 'border-box' as const,
  })

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 40,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 500,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-panel)',
            borderRadius: 10,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            zIndex: 50,
            padding: 24,
          }}
        >
          <Dialog.Close
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-sec)',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              borderRadius: 4,
            }}
          >
            <X size={16} />
          </Dialog.Close>

          <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-pri)', marginBottom: 4 }}>
            Manage Remotes
          </Dialog.Title>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 20 }}>
            Add, edit, or remove remote repositories.
          </Dialog.Description>

          {/* Remote list */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {remotes.length === 0 && !adding && (
              <p style={{ fontSize: 13, color: 'var(--text-ter)', textAlign: 'center', padding: '16px 0' }}>
                No remotes configured.
              </p>
            )}

            {remotes.map(remote => (
              <div
                key={remote.name}
                style={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-content)',
                  padding: '10px 12px',
                }}
              >
                {editingName === remote.name ? (
                  /* Edit row */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: '0 0 120px' }}>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-ter)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Name</label>
                        <input
                          autoFocus
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          style={inputStyle(false)}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-ter)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>URL</label>
                        <input
                          value={editURL}
                          onChange={e => setEditURL(e.target.value)}
                          style={inputStyle(false)}
                        />
                      </div>
                    </div>
                    {editError && <FieldError message={editError} />}
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Button onClick={cancelEdit} variant="secondary">Cancel</Button>
                      <Button
                        onClick={saveEdit}
                        disabled={updateMutation.isPending || renameMutation.isPending}
                        variant="primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <Check size={13} />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : pendingDelete === remote.name ? (
                  /* Delete confirmation */
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-pri)', marginBottom: 8 }}>
                      Remove remote <strong>{remote.name}</strong>?
                    </p>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Button onClick={() => setPendingDelete(null)} variant="secondary">Cancel</Button>
                      <Button
                        onClick={confirmDelete}
                        disabled={removeMutation.isPending}
                        variant="danger"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Display row */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-pri)' }}>{remote.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-sec)', fontFamily: 'monospace', marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {remote.fetchURL}
                      </span>
                    </div>
                    <Button variant="ghost"
                      onClick={() => { setAdding(false); startEdit(remote) }}
                      title="Edit remote"
                      aria-label="Edit remote"
                      style={iconBtnStyle}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button variant="ghost"
                      onClick={() => { setEditingName(null); setPendingDelete(remote.name) }}
                      title="Remove remote"
                      aria-label="Remove remote"
                      style={{ ...iconBtnStyle, color: 'var(--danger)' }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Add new remote form */}
            {adding && (
              <div style={{
                borderRadius: 8,
                border: '1px dashed var(--acc)',
                background: 'color-mix(in srgb, var(--acc) 5%, transparent)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: '0 0 120px' }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-ter)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Name</label>
                    <input
                      autoFocus
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="origin"
                      style={inputStyle(false)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-ter)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>URL</label>
                    <input
                      value={newURL}
                      onChange={e => setNewURL(e.target.value)}
                      placeholder="https://github.com/user/repo.git"
                      style={inputStyle(false)}
                    />
                  </div>
                </div>
                {addError && <FieldError message={addError} />}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Button onClick={() => { setAdding(false); setNewName(''); setNewURL(''); setAddError('') }} variant="secondary">Cancel</Button>
                  <Button
                    onClick={saveAdd}
                    disabled={addMutation.isPending}
                    variant="primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <Check size={13} />
                    {addMutation.isPending ? 'Adding…' : 'Add'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-sub)' }}>
            <Button
              onClick={() => { setEditingName(null); setPendingDelete(null); setAdding(true); setNewName(''); setNewURL(''); setAddError('') }}
              variant="secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Plus size={13} />
              Add Remote
            </Button>
            <Dialog.Close asChild>
              <Button variant="secondary">Close</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function FieldError({ message }: { message: string }) {
  return (
    <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
      <AlertCircle size={11} />
      {message}
    </p>
  )
}

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: 5,
  border: 'none',
  background: 'none',
  color: 'var(--text-sec)',
  cursor: 'pointer',
  flexShrink: 0,
}
