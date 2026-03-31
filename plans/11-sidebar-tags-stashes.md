# Bough – Plan 11: Sidebar Tags & Stashes

**Phase:** 3 (Power Features)
**Prerequisite:** `04-frontend.md`, `02-git-backend.md`, `07-worktrees.md` complete
**Goal:** Fully functional Tags and Stashes sections in the sidebar — list, click to act, context menus, and the Go backend methods to support them.

---

## 1. Current State

| Area | Status |
|------|--------|
| `Tag` Go struct (`name`, `hash`, `date`, `message`) | ✅ exists in `git/types.go` |
| Tags collected in `collectRefs()` / shown on commit graph | ✅ exists |
| `ListTags()` backend method | ❌ missing |
| `CheckoutTag()` / `DeleteTag()` backend methods | ❌ missing |
| `useTags()` frontend hook | ❌ missing |
| Tags sidebar section (header only, no children) | ⚠️ stub |
| `Tag` interface in `types.ts` | ❌ missing |
| `StashEntry` Go struct | ✅ exists in `git/types.go` |
| `ListStashes()` backend method | ❌ missing |
| `ApplyStash()` / `PopStash()` / `DropStash()` backend methods | ❌ missing |
| `useStashes()` frontend hook | ❌ missing |
| Stashes sidebar section (header only, no children) | ⚠️ stub |
| `StashEntry` interface in `types.ts` | ❌ missing |

---

## 2. Tags

### 2.1 Go Backend (`app/git/tags.go`)

Create `app/git/tags.go`:

```go
package git

import (
    "strings"
    "time"

    "github.com/go-git/go-git/v5/plumbing"
    "github.com/go-git/go-git/v5/plumbing/object"
)

// ListTags returns all tags sorted newest-first by the date of the tagged
// commit (for lightweight tags) or the tagger date (for annotated tags).
func (r *Repository) ListTags() ([]Tag, error) {
    iter, err := r.repo.Tags()
    if err != nil {
        return nil, err
    }

    var tags []Tag
    _ = iter.ForEach(func(ref *plumbing.Reference) error {
        name := ref.Name().Short()

        // Try annotated tag first (tag object → commit).
        if tagObj, err := r.repo.TagObject(ref.Hash()); err == nil {
            tags = append(tags, Tag{
                Name:    name,
                Hash:    tagObj.Target.String(),
                Date:    tagObj.Tagger.When,
                Message: strings.TrimSpace(tagObj.Message),
            })
            return nil
        }

        // Lightweight tag — ref points directly to a commit.
        if commit, err := r.repo.CommitObject(ref.Hash()); err == nil {
            tags = append(tags, Tag{
                Name: name,
                Hash: commit.Hash.String(),
                Date: commit.Committer.When,
            })
        }
        return nil
    })

    // Sort newest first.
    sort.Slice(tags, func(i, j int) bool {
        return tags[i].Date.After(tags[j].Date)
    })

    return tags, nil
}

// CheckoutTag detaches HEAD at the commit the tag points to.
// Uses CLI so hooks run and the working tree is updated correctly.
func (r *Repository) CheckoutTag(tag string) error {
    _, err := CLI(r.Path, "checkout", tag)
    return err
}

// DeleteTag removes a local tag by name.
func (r *Repository) DeleteTag(tag string) error {
    _, err := CLI(r.Path, "tag", "-d", tag)
    return err
}
```

Add `"sort"` to the import block.

### 2.2 App bindings (`app/app.go`)

```go
// --- Tags ---

func (a *App) ListTags() ([]gitpkg.Tag, error) {
    if a.repo == nil {
        return nil, gitpkg.ErrNotARepo
    }
    return a.repo.ListTags()
}

func (a *App) CheckoutTag(tag string) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    if err := a.repo.CheckoutTag(tag); err != nil {
        return err
    }
    wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
    return nil
}

func (a *App) DeleteTag(tag string) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    if err := a.repo.DeleteTag(tag); err != nil {
        return err
    }
    wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
    return nil
}
```

### 2.3 TypeScript type (`app/frontend/src/lib/types.ts`)

```ts
export interface Tag {
  name: string
  hash: string
  date: string   // ISO 8601 — serialised from time.Time by Wails
  message: string
}
```

### 2.4 Hook (`app/frontend/src/hooks/useTags.ts`)

```ts
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListTags, CheckoutTag, DeleteTag } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import type { Tag } from '@/lib/types'

export function useTags() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await ListTags()) as Tag[],
    staleTime: 30_000,
  })

  useEffect(() => {
    const unsub = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [queryClient])

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['tags'] })
    queryClient.invalidateQueries({ queryKey: ['commits'] })
    queryClient.invalidateQueries({ queryKey: ['branches'] })
  }

  const checkoutMutation = useMutation({
    mutationFn: (tag: string) => CheckoutTag(tag),
    onSuccess: invalidateAll,
  })

  const deleteMutation = useMutation({
    mutationFn: (tag: string) => DeleteTag(tag),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  })

  return { ...query, checkoutMutation, deleteMutation }
}
```

### 2.5 Sidebar integration

In `Sidebar.tsx`:

- Import `useTags` and add `Tag` to the `PendingConfirm` union:

```ts
| { kind: 'checkoutTag'; tag: string }
| { kind: 'deleteTag'; tag: string }
```

- Populate the Tags section:

```tsx
<Section
  title="Tags"
  icon={<Tag size={13} />}
  expanded={expanded.tags}
  onToggle={() => toggle('tags')}
>
  {tags?.map(t => (
    <ContextMenu
      key={t.name}
      items={[
        { label: 'Checkout tag', onClick: () => setPending({ kind: 'checkoutTag', tag: t.name }) },
        { type: 'separator' },
        { label: 'Delete tag', destructive: true, onClick: () => setPending({ kind: 'deleteTag', tag: t.name }) },
      ]}
    >
      <div>
        <SidebarItem
          label={t.name}
          onClick={() => setPending({ kind: 'checkoutTag', tag: t.name })}
        />
      </div>
    </ContextMenu>
  ))}
</Section>
```

- Handle the new cases in `handleConfirm`:

```ts
case 'checkoutTag':
  tagCheckoutMutation.mutate(pending.tag, {
    onSuccess: () => showFlash(`Detached HEAD at '${pending.tag}'`, 'info'),
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })
  break
case 'deleteTag':
  tagDeleteMutation.mutate(pending.tag, {
    onSuccess: () => showFlash(`Deleted tag '${pending.tag}'`, 'success'),
    onError: (err: Error) => showFlash(parseGitError(err), 'danger'),
  })
  break
```

- Confirm dialog strings:

| kind | title | body | button |
|------|-------|------|--------|
| `checkoutTag` | `Checkout tag '<name>'?` | `This will detach HEAD at the tagged commit.` | Checkout |
| `deleteTag` | `Delete tag '<name>'?` | `This only removes the local tag. Push a delete to share the change.` | Delete (danger) |

---

## 3. Stashes

### 3.1 Go Backend (`app/git/stash.go`)

The `StashEntry` struct already exists in `git/types.go`:

```go
type StashEntry struct {
    Index   int       `json:"index"`
    Message string    `json:"message"`
    Hash    string    `json:"hash"`
    Date    time.Time `json:"date"`
}
```

Create `app/git/stash.go`:

```go
package git

import (
    "fmt"
    "strconv"
    "strings"
    "time"
)

// ListStashes returns all stash entries in stash order (newest first).
// Parses `git stash list --format=...` output.
func (r *Repository) ListStashes() ([]StashEntry, error) {
    out, err := CLI(r.Path, "stash", "list",
        "--format=%gd\t%H\t%ai\t%s")
    if err != nil {
        return nil, err
    }
    out = strings.TrimSpace(out)
    if out == "" {
        return nil, nil
    }

    var entries []StashEntry
    for _, line := range strings.Split(out, "\n") {
        parts := strings.SplitN(line, "\t", 4)
        if len(parts) != 4 {
            continue
        }
        // parts[0] = "stash@{N}", parts[1] = hash, parts[2] = date, parts[3] = subject
        idxStr := strings.TrimSuffix(strings.TrimPrefix(parts[0], "stash@{"), "}")
        idx, _ := strconv.Atoi(idxStr)
        date, _ := time.Parse("2006-01-02 15:04:05 -0700", parts[2])
        entries = append(entries, StashEntry{
            Index:   idx,
            Hash:    parts[1],
            Date:    date,
            Message: parts[3],
        })
    }
    return entries, nil
}

// ApplyStash applies stash@{index} without removing it from the stash list.
func (r *Repository) ApplyStash(index int) error {
    _, err := CLI(r.Path, "stash", "apply", fmt.Sprintf("stash@{%d}", index))
    return err
}

// PopStash applies stash@{index} and removes it from the stash list.
func (r *Repository) PopStash(index int) error {
    _, err := CLI(r.Path, "stash", "pop", fmt.Sprintf("stash@{%d}", index))
    return err
}

// DropStash removes stash@{index} without applying it.
func (r *Repository) DropStash(index int) error {
    _, err := CLI(r.Path, "stash", "drop", fmt.Sprintf("stash@{%d}", index))
    return err
}
```

### 3.2 App bindings (`app/app.go`)

```go
// --- Stashes ---

func (a *App) ListStashes() ([]gitpkg.StashEntry, error) {
    if a.repo == nil {
        return nil, gitpkg.ErrNotARepo
    }
    return a.repo.ListStashes()
}

func (a *App) ApplyStash(index int) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    if err := a.repo.ApplyStash(index); err != nil {
        return err
    }
    wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
    return nil
}

func (a *App) PopStash(index int) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    if err := a.repo.PopStash(index); err != nil {
        return err
    }
    wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
    return nil
}

func (a *App) DropStash(index int) error {
    if a.repo == nil {
        return gitpkg.ErrNotARepo
    }
    if err := a.repo.DropStash(index); err != nil {
        return err
    }
    wailsruntime.EventsEmit(a.ctx, "repo:changed", a.repo.Path)
    return nil
}
```

### 3.3 TypeScript type (`app/frontend/src/lib/types.ts`)

```ts
export interface StashEntry {
  index: number
  message: string
  hash: string
  date: string   // ISO 8601
}
```

### 3.4 Hook (`app/frontend/src/hooks/useStashes.ts`)

```ts
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListStashes, ApplyStash, PopStash, DropStash } from '@wailsjs/go/main/App'
import { EventsOn } from '@wailsjs/runtime/runtime'
import type { StashEntry } from '@/lib/types'

export function useStashes() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['stashes'],
    queryFn: async () => (await ListStashes()) as StashEntry[],
    staleTime: 30_000,
  })

  useEffect(() => {
    const unsub = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['stashes'] })
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [queryClient])

  const invalidateAfterApply = () => {
    queryClient.invalidateQueries({ queryKey: ['stashes'] })
    queryClient.invalidateQueries({ queryKey: ['status'] })
  }

  const applyMutation = useMutation({
    mutationFn: (index: number) => ApplyStash(index),
    onSuccess: invalidateAfterApply,
  })

  const popMutation = useMutation({
    mutationFn: (index: number) => PopStash(index),
    onSuccess: invalidateAfterApply,
  })

  const dropMutation = useMutation({
    mutationFn: (index: number) => DropStash(index),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stashes'] }),
  })

  return { ...query, applyMutation, popMutation, dropMutation }
}
```

### 3.5 Sidebar integration

Extend `PendingConfirm`:

```ts
| { kind: 'applyStash'; entry: StashEntry }
| { kind: 'popStash'; entry: StashEntry }
| { kind: 'dropStash'; entry: StashEntry }
```

Populate the Stashes section:

```tsx
<Section
  title="Stashes"
  icon={<Archive size={13} />}
  expanded={expanded.stashes}
  onToggle={() => toggle('stashes')}
>
  {stashes && stashes.length === 0 && (
    <div style={{ height: 24, display: 'flex', alignItems: 'center', padding: '0 8px',
      fontSize: 11, color: 'var(--text-ter)' }}>
      No stashes
    </div>
  )}
  {stashes?.map(s => (
    <ContextMenu
      key={s.index}
      items={[
        { label: 'Apply stash', onClick: () => setPending({ kind: 'applyStash', entry: s }) },
        { label: 'Pop stash', onClick: () => setPending({ kind: 'popStash', entry: s }) },
        { type: 'separator' },
        { label: 'Drop stash', destructive: true, onClick: () => setPending({ kind: 'dropStash', entry: s }) },
      ]}
    >
      <div>
        <SidebarItem
          label={s.message}
          onClick={() => setPending({ kind: 'popStash', entry: s })}
        />
      </div>
    </ContextMenu>
  ))}
</Section>
```

- Click = pop (the most common action: apply and remove).
- Confirm dialog strings:

| kind | title | body | button |
|------|-------|------|--------|
| `applyStash` | `Apply stash?` | `'<message>' will be applied to your working tree. The stash entry is kept.` | Apply |
| `popStash` | `Pop stash?` | `'<message>' will be applied and then removed from the stash list.` | Pop |
| `dropStash` | `Drop stash?` | `'<message>' will be permanently deleted.` | Drop (danger) |

---

## 4. Shared note on `PendingConfirm`

`Sidebar.tsx` already has a single `Dialog.Root` driven by `pending` state. Both tags and stashes extend the same union type and the same `handleConfirm` switch — no new dialog components are needed.

---

## 5. Verification Checklist

### Tags
- [ ] `ListTags()` returns annotated and lightweight tags, sorted newest-first
- [ ] Annotated tag shows its `message`; lightweight tag has empty message
- [ ] Clicking a tag opens confirm dialog "Checkout tag?"
- [ ] Confirming detaches HEAD at the tag commit; `repo:changed` fires; commit graph updates
- [ ] Context menu shows "Checkout tag" and "Delete tag"
- [ ] Deleting a tag removes it from the list without switching branches
- [ ] Wails bindings (`App.js` / `App.d.ts`) include `ListTags`, `CheckoutTag`, `DeleteTag`

### Stashes
- [ ] `ListStashes()` returns all stash entries with correct index, message, and date
- [ ] Empty stash list shows "No stashes" placeholder
- [ ] Clicking a stash entry pops it (apply + drop); working tree and status update
- [ ] Context menu has Apply / Pop / Drop with correct behaviour
- [ ] Drop shows a danger-coloured confirm button
- [ ] After any stash operation `status` query is invalidated and Changes view refreshes
- [ ] Wails bindings include `ListStashes`, `ApplyStash`, `PopStash`, `DropStash`
