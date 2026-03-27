# Implementation Plan: Worktree Management

## Overview
Git worktrees allow multiple working directories for the same repository. Bough integrates worktree management into the sidebar with add/remove/switch functionality and dirty state detection.

---

## Frontend: WorktreeList Component

**File:** `bough/frontend/src/components/Sidebar.tsx` (worktree section)

```typescript
// Inside Sidebar component, add WorktreeSection:

<SidebarSection
  title="Worktrees"
  icon={Layers}
  expanded={expandedSections.worktrees}
  onToggle={() => toggleSection('worktrees')}
  onAdd={() => setShowNewWorktreeDialog(true)}
>
  <WorktreeList />
</SidebarSection>

{showNewWorktreeDialog && (
  <NewWorktreeDialog
    onClose={() => setShowNewWorktreeDialog(false)}
    onSuccess={() => {
      setShowNewWorktreeDialog(false);
    }}
  />
)}
```

---

## WorktreeList Component

**File:** `bough/frontend/src/components/WorktreeList.tsx`

```typescript
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListWorktrees } from '../wailsjs/go/main/App';
import { WorktreeInfo } from '../types';
import { useAppStore } from '../store/appStore';
import { Layers, FileText, MoreVertical } from 'lucide-react';
import { ContextMenu } from './ContextMenu';

export const WorktreeList: React.FC = () => {
  const { data: worktrees = [] } = useQuery({
    queryKey: ['worktrees'],
    queryFn: ListWorktrees,
    staleTime: 30000,
  });

  return (
    <div className="flex flex-col">
      {worktrees.length === 0 ? (
        <div className="h-6 px-4 text-xs text-text-ter flex items-center">
          No worktrees
        </div>
      ) : (
        worktrees.map((wt) => (
          <WorktreeItem key={wt.path} worktree={wt} />
        ))
      )}
    </div>
  );
};

interface WorktreeItemProps {
  worktree: WorktreeInfo;
}

const WorktreeItem: React.FC<WorktreeItemProps> = ({ worktree }) => {
  const { activeWorktree, setActiveWorktree } = useAppStore();
  const isActive = activeWorktree === worktree.path;

  const displayName = worktree.path.split('/').pop() || worktree.path;

  return (
    <ContextMenu
      items={[
        {
          label: 'Switch to Worktree',
          onClick: () => setActiveWorktree(worktree.path),
        },
        {
          label: 'Open in Finder',
          onClick: () => {
            // Platform-specific: macOS opens Finder
            window.runtime?.EventsEmit('open-in-finder', worktree.path);
          },
        },
        {
          label: 'Open in New Window',
          onClick: () => {
            window.runtime?.EventsEmit('open-worktree-window', worktree.path);
          },
        },
        { type: 'separator' },
        {
          label: 'Remove Worktree',
          destructive: true,
          onClick: () => {
            // Show confirm dialog
          },
        },
      ]}
    >
      <div
        onClick={() => setActiveWorktree(worktree.path)}
        className={`
          h-6 px-2 flex items-center gap-2 text-xs cursor-pointer
          transition-colors group
          ${isActive ? 'bg-acc text-white' : 'text-text-sec hover:bg-panel'}
        `}
      >
        <Layers size={12} className="flex-shrink-0" />
        <span className="truncate flex-1 font-mono">
          {displayName}
        </span>
        {worktree.isDirty && (
          <span
            className="w-2 h-2 rounded-full bg-warn flex-shrink-0"
            title="Has uncommitted changes"
          />
        )}
        <button
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            // Trigger context menu
          }}
        >
          <MoreVertical size={12} />
        </button>
      </div>
    </ContextMenu>
  );
};
```

---

## NewWorktreeDialog Component

**File:** `bough/frontend/src/components/NewWorktreeDialog.tsx`

```typescript
import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AddWorktree, ListBranches } from '../wailsjs/go/main/App';
import { useAppStore } from '../store/appStore';
import * as Dialog from '@radix-ui/react-dialog';
import { X, AlertCircle } from 'lucide-react';

interface NewWorktreeDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const NewWorktreeDialog: React.FC<NewWorktreeDialogProps> = ({
  onClose,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const { showNotification } = useAppStore();

  const [selectedBranch, setSelectedBranch] = useState('');
  const [pathInput, setPathInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: branchData } = useQuery({
    queryKey: ['branches'],
    queryFn: ListBranches,
  });

  const allBranches = useMemo(() => {
    if (!branchData) return [];
    return [
      ...(branchData.local || []),
      ...(branchData.remotes || []),
    ];
  }, [branchData]);

  const addWorktreeMutation = useMutation({
    mutationFn: async (params: { path: string; branch: string }) => {
      return AddWorktree(params.path, params.branch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] });
      showNotification({
        message: 'Worktree created successfully',
        type: 'success'
      });
      onSuccess();
    },
    onError: (error: Error) => {
      showNotification({
        message: `Failed to create worktree: ${error.message}`,
        type: 'error'
      });
    }
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedBranch) {
      newErrors.branch = 'Select a branch';
    }

    if (!pathInput.trim()) {
      newErrors.path = 'Enter a path';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    addWorktreeMutation.mutate({
      path: pathInput,
      branch: selectedBranch,
    });
  };

  // Auto-generate path from branch name
  const handleBranchSelect = (branch: string) => {
    setSelectedBranch(branch);
    if (!pathInput) {
      const branchDir = branch.replace(/\//g, '-');
      setPathInput(`../${branchDir}`);
    }
  };

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-panel rounded-lg shadow-2xl z-50 p-6 space-y-6">
          {/* Close button */}
          <Dialog.Close className="absolute top-4 right-4 p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors">
            <X size={18} className="text-text-pri" />
          </Dialog.Close>

          {/* Title */}
          <Dialog.Title className="text-lg font-bold text-text-pri">
            Create New Worktree
          </Dialog.Title>

          {/* Description */}
          <Dialog.Description className="text-sm text-text-sec">
            Create a new linked working directory for a different branch.
          </Dialog.Description>

          {/* Form */}
          <div className="space-y-4">
            {/* Branch selector */}
            <div>
              <label className="block text-xs font-semibold text-text-pri mb-2">
                Branch <span className="text-danger">*</span>
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => handleBranchSelect(e.target.value)}
                className={`
                  w-full px-3 py-2 rounded border bg-content text-text-pri text-sm
                  outline-none focus:ring-1 transition-colors
                  ${errors.branch
                    ? 'border-danger focus:border-danger focus:ring-danger'
                    : 'border-slate-300 dark:border-slate-700 focus:border-acc focus:ring-acc'
                  }
                `}
              >
                <option value="">Select a branch...</option>
                {allBranches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
              {errors.branch && (
                <p className="text-xs text-danger mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.branch}
                </p>
              )}
            </div>

            {/* Path input */}
            <div>
              <label className="block text-xs font-semibold text-text-pri mb-2">
                Path <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                placeholder="../branch-name"
                className={`
                  w-full px-3 py-2 rounded border bg-content text-text-pri text-sm font-mono
                  outline-none focus:ring-1 transition-colors
                  ${errors.path
                    ? 'border-danger focus:border-danger focus:ring-danger'
                    : 'border-slate-300 dark:border-slate-700 focus:border-acc focus:ring-acc'
                  }
                `}
              />
              {errors.path && (
                <p className="text-xs text-danger mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.path}
                </p>
              )}
              <p className="text-xs text-text-ter mt-1">
                Relative path from the current repository
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-4">
            <Dialog.Close asChild>
              <button className="px-4 py-2 rounded text-sm font-medium text-text-pri hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSubmit}
              disabled={addWorktreeMutation.isPending}
              className="
                px-4 py-2 rounded text-sm font-medium
                bg-acc text-white hover:bg-blue-700 active:bg-blue-900
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {addWorktreeMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
```

---

## ContextMenu Component (Radix UI)

**File:** `bough/frontend/src/components/ContextMenu.tsx`

```typescript
import React from 'react';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { ChevronRight } from 'lucide-react';

interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  destructive?: boolean;
  type?: 'separator' | 'item';
  shortcut?: string;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  children
}) => {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        {children}
      </ContextMenuPrimitive.Trigger>

      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content className="
          min-w-[180px] rounded-lg shadow-lg bg-panel border border-slate-200 dark:border-slate-800
          py-1 overflow-hidden z-50
          data-[state=open]:animate-in data-[state=closed]:animate-out
          data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
          data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
        ">
          {items.map((item, idx) => {
            if (item.type === 'separator') {
              return (
                <ContextMenuPrimitive.Separator
                  key={idx}
                  className="h-px bg-slate-200 dark:bg-slate-800 my-1"
                />
              );
            }

            return (
              <ContextMenuPrimitive.Item
                key={idx}
                onSelect={item.onClick}
                className={`
                  px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2
                  outline-none
                  ${item.destructive
                    ? 'text-danger hover:bg-red-100 dark:hover:bg-red-950'
                    : 'text-text-pri hover:bg-slate-200 dark:hover:bg-slate-800'
                  }
                  transition-colors
                `}
              >
                {item.label}
                {item.shortcut && (
                  <span className="text-xs text-text-ter font-mono">
                    {item.shortcut}
                  </span>
                )}
              </ContextMenuPrimitive.Item>
            );
          })}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
};
```

---

## Go Backend: git/worktrees.go

```go
package git

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
)

type WorktreeInfo struct {
	Path      string `json:"path"`
	Branch    string `json:"branch"`
	Head      string `json:"head"`
	IsMain    bool   `json:"isMain"`
	IsDirty   bool   `json:"isDirty"`
	IsLinked  bool   `json:"isLinked"`
}

// ListWorktrees returns all worktrees linked to this repository
func (g *Git) ListWorktrees(ctx context.Context, repoPath string) ([]WorktreeInfo, error) {
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open repo: %w", err)
	}

	wtree, err := repo.Worktree()
	if err != nil {
		return nil, fmt.Errorf("failed to get worktree: %w", err)
	}

	var worktrees []WorktreeInfo

	// Main worktree
	mainRef, err := repo.Head()
	mainBranch := "unknown"
	if err == nil && mainRef.Name().IsBranch() {
		mainBranch = mainRef.Name().Short()
	}

	mainDirty, err := isDirty(wtree)
	mainWt := WorktreeInfo{
		Path:     repoPath,
		Branch:   mainBranch,
		Head:     mainRef.Hash().String()[:7],
		IsMain:   true,
		IsDirty:  mainDirty,
		IsLinked: false,
	}
	worktrees = append(worktrees, mainWt)

	// Linked worktrees via git worktree list
	cmd := exec.CommandContext(ctx, "git", "-C", repoPath, "worktree", "list", "--porcelain")
	output, err := cmd.Output()
	if err != nil {
		// git worktree list might fail on older git versions
		return worktrees, nil
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}

		wtPath := parts[0]
		if wtPath == repoPath {
			// Skip the main worktree
			continue
		}

		// Extract branch from the full ref
		branch := "detached"
		for _, part := range parts {
			if strings.HasPrefix(part, "branch") {
				refParts := strings.Split(part, "/")
				if len(refParts) > 0 {
					branch = strings.TrimPrefix(part, "branch ")
				}
				break
			}
		}

		// Check if worktree is dirty
		wtRepo, err := git.PlainOpen(wtPath)
		var isDirtyWt bool
		if err == nil {
			wtWtree, err := wtRepo.Worktree()
			isDirtyWt, _ = isDirty(wtWtree)
		}

		worktree := WorktreeInfo{
			Path:     wtPath,
			Branch:   branch,
			IsMain:   false,
			IsDirty:  isDirtyWt,
			IsLinked: true,
		}
		worktrees = append(worktrees, worktree)
	}

	return worktrees, nil
}

// AddWorktree creates a new linked worktree
func (g *Git) AddWorktree(ctx context.Context, repoPath, path, branch string) error {
	// Validate inputs
	if path == "" {
		return fmt.Errorf("path cannot be empty")
	}
	if branch == "" {
		return fmt.Errorf("branch cannot be empty")
	}

	// Expand relative paths (e.g., ../ )
	if strings.HasPrefix(path, "..") {
		absPath, err := filepath.Abs(filepath.Join(repoPath, path))
		if err != nil {
			return fmt.Errorf("invalid path: %w", err)
		}
		path = absPath
	}

	// Check if path already exists
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		return fmt.Errorf("path already exists: %s", path)
	}

	// Create the worktree with git
	cmd := exec.CommandContext(ctx, "git", "-C", repoPath, "worktree", "add", "-b", branch, path)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to add worktree: %w", err)
	}

	return nil
}

// RemoveWorktree removes a linked worktree
func (g *Git) RemoveWorktree(ctx context.Context, repoPath, wtPath string) error {
	if wtPath == repoPath {
		return fmt.Errorf("cannot remove the main worktree")
	}

	// Check if dirty and warn
	repo, err := git.PlainOpen(wtPath)
	if err == nil {
		wtree, err := repo.Worktree()
		if err == nil {
			if dirty, _ := isDirty(wtree); dirty {
				// Log warning, but allow removal with --force flag
			}
		}
	}

	// Remove the worktree
	cmd := exec.CommandContext(ctx, "git", "-C", repoPath, "worktree", "remove", "--force", wtPath)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to remove worktree: %w", err)
	}

	return nil
}

// PruneWorktrees removes worktree entries for deleted directories
func (g *Git) PruneWorktrees(ctx context.Context, repoPath string) error {
	cmd := exec.CommandContext(ctx, "git", "-C", repoPath, "worktree", "prune")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to prune worktrees: %w", err)
	}

	return nil
}

// isDirty checks if a worktree has uncommitted changes
func isDirty(wtree *git.Worktree) (bool, error) {
	status, err := wtree.Status()
	if err != nil {
		return false, err
	}

	return !status.IsClean(), nil
}
```

---

## Go Backend: app.go (Wails bindings)

```go
// In main/app.go or git/app.go, add these methods:

// ListWorktrees returns all worktrees for the current repository
func (a *App) ListWorktrees(ctx context.Context) ([]WorktreeInfo, error) {
	if a.repo == nil {
		return nil, errors.New("no repository open")
	}

	return a.git.ListWorktrees(ctx, a.repoPath)
}

// AddWorktree creates a new linked worktree
func (a *App) AddWorktree(ctx context.Context, path, branch string) error {
	if a.repo == nil {
		return errors.New("no repository open")
	}

	if err := a.git.AddWorktree(ctx, a.repoPath, path, branch); err != nil {
		return err
	}

	// Emit event that worktrees changed
	a.events.Emit("repo:worktrees-changed")

	return nil
}

// RemoveWorktree removes a linked worktree
func (a *App) RemoveWorktree(ctx context.Context, wtPath string) error {
	if a.repo == nil {
		return errors.New("no repository open")
	}

	if err := a.git.RemoveWorktree(ctx, a.repoPath, wtPath); err != nil {
		return err
	}

	// Emit event that worktrees changed
	a.events.Emit("repo:worktrees-changed")

	return nil
}

// SwitchWorktree opens a different worktree context
func (a *App) SwitchWorktree(ctx context.Context, wtPath string) error {
	// Open the worktree repository
	repo, err := git.PlainOpen(wtPath)
	if err != nil {
		return fmt.Errorf("failed to open worktree: %w", err)
	}

	a.repo = repo
	a.repoPath = wtPath

	// Start watching the new worktree
	a.stopWatcher()
	a.startWatcher()

	// Invalidate all queries
	a.events.Emit("repo:changed")

	return nil
}
```

---

## TypeScript Types

**File:** `bough/frontend/src/types/index.ts`

```typescript
export interface WorktreeInfo {
  path: string;
  branch: string;
  head?: string;
  isMain: boolean;
  isDirty: boolean;
  isLinked?: boolean;
}
```

---

## useWorktrees Hook

**File:** `bough/frontend/src/hooks/useWorktrees.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListWorktrees, AddWorktree as AddWorktreeAPI, RemoveWorktree as RemoveWorktreeAPI, SwitchWorktree } from '../wailsjs/go/main/App';
import { useAppStore } from '../store/appStore';
import { EventsOn } from '../wailsjs/runtime';
import { useEffect } from 'react';

export const useWorktrees = () => {
  const queryClient = useQueryClient();
  const { setWorktrees, setActiveWorktree } = useAppStore();

  const query = useQuery({
    queryKey: ['worktrees'],
    queryFn: ListWorktrees,
    staleTime: 30000,
  });

  const addMutation = useMutation({
    mutationFn: (params: { path: string; branch: string }) =>
      AddWorktreeAPI(params.path, params.branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (path: string) =>
      RemoveWorktreeAPI(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] });
    },
  });

  const switchMutation = useMutation({
    mutationFn: (path: string) =>
      SwitchWorktree(path),
    onSuccess: (_, path) => {
      setActiveWorktree(path);
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });

  // Listen for worktree changes
  useEffect(() => {
    const unsubscribe = EventsOn('repo:worktrees-changed', () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] });
    });
    return unsubscribe;
  }, [queryClient]);

  return {
    ...query,
    addMutation,
    removeMutation,
    switchMutation,
  };
};
```

---

## fsnotify Integration (Watch Multiple Worktrees)

**File:** `bough/git/watcher.go`

```go
package git

import (
	"context"
	"fmt"
	"log"
	"path/filepath"

	"github.com/fsnotify/fsnotify"
)

type FileWatcher struct {
	watcher *fsnotify.Watcher
	done    chan struct{}
	paths   map[string]bool
}

// StartWatchingWorktrees watches all linked worktree directories
func (g *Git) StartWatchingWorktrees(ctx context.Context, repoPath string, callback func(event string)) error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("failed to create watcher: %w", err)
	}

	// Get all worktrees
	worktrees, err := g.ListWorktrees(ctx, repoPath)
	if err != nil {
		watcher.Close()
		return err
	}

	// Watch each worktree's .git directory
	for _, wt := range worktrees {
		gitDir := filepath.Join(wt.Path, ".git")
		if err := watcher.Add(gitDir); err != nil {
			log.Printf("warning: failed to watch %s: %v", gitDir, err)
		}
	}

	// Watch main repo's .git
	if err := watcher.Add(filepath.Join(repoPath, ".git")); err != nil {
		log.Printf("warning: failed to watch main repo: %v", err)
	}

	// Monitor events in goroutine
	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}

				// Debounce: only emit if it's a meaningful change
				if filepath.Base(event.Name) == "HEAD" ||
					filepath.Base(event.Name) == "index" {
					callback("repo:changed")
				}

			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Printf("watcher error: %v", err)

			case <-ctx.Done():
				watcher.Close()
				return
			}
		}
	}()

	return nil
}
```

---

## Verification Checklist

- [ ] WorktreeList displays all linked worktrees
- [ ] Dirty indicator (orange dot) appears for modified worktrees
- [ ] Clicking worktree item switches context (invalidates all queries)
- [ ] Add button opens NewWorktreeDialog
- [ ] Branch selector shows local and remote branches
- [ ] Path input auto-fills from branch name
- [ ] Create button validates inputs and shows errors
- [ ] AddWorktree Go function creates directory correctly
- [ ] Context menu appears on right-click
- [ ] "Switch to Worktree" changes activeWorktree
- [ ] "Remove Worktree" removes directory and git entry
- [ ] "Open in Finder" opens native file browser (platform-specific)
- [ ] ListWorktrees query invalidates on 'repo:worktrees-changed' event
- [ ] File watcher detects changes in .git directories across all worktrees
- [ ] No console errors when switching between worktrees
- [ ] Empty worktree list shows "No worktrees" message

---

## Implementation Order

1. Define WorktreeInfo type in Go and TypeScript
2. Implement ListWorktrees Go function
3. Create WorktreeList React component
4. Add worktrees section to Sidebar
5. Implement AddWorktree Go function (git worktree add)
6. Build NewWorktreeDialog with branch selector
7. Implement RemoveWorktree Go function (git worktree remove --force)
8. Add context menu to WorktreeItem (Radix UI)
9. Implement SwitchWorktree (change repo context)
10. Add query invalidation on switch
11. Implement file watcher for multiple worktrees
12. Test switching between worktrees
13. Add "Open in Finder/Explorer" platform-specific actions
14. Test removing worktree with dirty indicator
15. Add PruneWorktrees cleanup function

---

## Platform-Specific Code

For "Open in Finder" (macOS) and "Open in Explorer" (Windows), emit Wails events:

```go
// In Go
runtime.EventsEmit(ctx, "open-in-finder", wtPath)
runtime.EventsEmit(ctx, "open-in-explorer", wtPath)

// Handle via JavaScript
EventsOn('open-in-finder', (path: string) => {
  invoke('OpenInFinder', { path });
});
```

Then implement in native Wails app:

```go
// app.go
func (a *App) OpenInFinder(ctx context.Context, path string) error {
  if runtime.GOOS != "darwin" {
    return errors.New("OpenInFinder only works on macOS")
  }

  cmd := exec.CommandContext(ctx, "open", path)
  return cmd.Run()
}

func (a *App) OpenInExplorer(ctx context.Context, path string) error {
  if runtime.GOOS != "windows" {
    return errors.New("OpenInExplorer only works on Windows")
  }

  cmd := exec.CommandContext(ctx, "explorer", path)
  return cmd.Run()
}
```
