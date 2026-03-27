# Implementation Plan: Frontend Architecture & Shared Components

## Overview
This document covers the React component architecture, shared UI components, global state management, and integration patterns for the Bough frontend.

---

## App Shell Layout

**File:** `bough/frontend/src/App.tsx`

```typescript
import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventsOn } from './wailsjs/runtime';
import { Titlebar } from './components/Titlebar';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { HistoryView } from './views/HistoryView';
import { ChangesView } from './views/ChangesView';
import { CommandPalette } from './components/CommandPalette';
import { FlashNotification } from './components/FlashNotification';
import { useAppStore } from './store/appStore';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

export const App: React.FC = () => {
  const { theme, activeView, showSidebar } = useAppStore();

  // Listen for repo changes and invalidate queries
  useEffect(() => {
    const unsubscribe = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    });
    return unsubscribe;
  }, []);

  // Apply theme class to root
  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className={`
          flex flex-col h-screen bg-content text-text-pri
          ${theme === 'dark' ? 'dark' : 'light'}
        `}
      >
        {/* Titlebar */}
        <Titlebar />

        {/* Toolbar */}
        <Toolbar />

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar (only in History view) */}
          {showSidebar && activeView === 'history' && (
            <Sidebar />
          )}

          {/* View content */}
          <main className="flex-1 overflow-hidden">
            {activeView === 'history' && <HistoryView />}
            {activeView === 'changes' && <ChangesView />}
          </main>
        </div>

        {/* Global components */}
        <CommandPalette />
        <FlashNotification />
      </div>
    </QueryClientProvider>
  );
};
```

---

## Titlebar Component

**File:** `bough/frontend/src/components/Titlebar.tsx`

Frameless, custom titlebar with macOS traffic lights and theme toggle.

```typescript
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export const Titlebar: React.FC = () => {
  const { theme, setTheme, activeRepo } = useAppStore();

  return (
    <div
      className="
        h-10 bg-sidebar border-b border-slate-200 dark:border-slate-800
        flex items-center justify-between px-4 gap-4
        select-none
      "
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* macOS traffic lights (platform-specific via CSS) */}
      <div
        className="w-12 h-10 flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Rendered via native Wails titlebar config */}
      </div>

      {/* App title & repo name */}
      <div className="flex-1 text-center">
        <h1 className="text-sm font-semibold text-text-pri">
          Bough
          {activeRepo && (
            <span className="text-text-ter ml-2">
              — {activeRepo.split('/').pop()}
            </span>
          )}
        </h1>
      </div>

      {/* Theme toggle */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="
            p-2 rounded hover:bg-panel
            transition-colors
          "
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun size={16} className="text-text-pri" />
          ) : (
            <Moon size={16} className="text-text-pri" />
          )}
        </button>
      </div>
    </div>
  );
};
```

---

## Toolbar Component

**File:** `bough/frontend/src/components/Toolbar.tsx`

Repository selector, view tabs, and action buttons.

```typescript
import React, { useState } from 'react';
import { ChevronDown, Plus, GitFetch, GitPullRequest, Upload, GitBranch, Archive, Tag, Search } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useStatus } from '../hooks/useStatus';
import { DropdownMenu } from './DropdownMenu';

export const Toolbar: React.FC = () => {
  const { activeView, setActiveView, activeRepo } = useAppStore();
  const { data: status } = useStatus();
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);

  const unstagedCount = status?.files?.filter(f => f.unstaged).length ?? 0;
  const stagedCount = status?.files?.filter(f => f.staged).length ?? 0;

  return (
    <div className="h-11 bg-sidebar border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 gap-4">

      {/* Repo selector */}
      <DropdownMenu
        trigger={
          <button className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-panel transition-colors">
            <span className="text-sm font-medium truncate max-w-[150px]">
              {activeRepo?.split('/').pop() || 'No Repository'}
            </span>
            <ChevronDown size={14} className="text-text-ter flex-shrink-0" />
          </button>
        }
        items={[
          { label: 'Open Repository...', onClick: () => {} },
          { label: 'Recent Repos', type: 'submenu' },
        ]}
      />

      {/* View tabs */}
      <div className="flex items-center gap-1 ml-4 border-l border-slate-200 dark:border-slate-800 pl-4">
        <TabButton
          label="History"
          active={activeView === 'history'}
          onClick={() => setActiveView('history')}
        />
        <TabButton
          label="Changes"
          active={activeView === 'changes'}
          badge={stagedCount + unstagedCount}
          onClick={() => setActiveView('changes')}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 ml-auto border-l border-slate-200 dark:border-slate-800 pl-4">
        <ToolbarButton icon={GitFetch} label="Fetch" />
        <ToolbarButton icon={GitPullRequest} label="Pull" />
        <ToolbarButton icon={Upload} label="Push" />
        <ToolbarButton icon={GitBranch} label="Branch" />
        <ToolbarButton icon={Archive} label="Stash" />
        <ToolbarButton icon={Tag} label="Tag" />

        {/* Command palette trigger */}
        <ToolbarButton
          icon={Search}
          label="Command"
          shortcut="⌘K"
          onClick={() => window.dispatchEvent(new CustomEvent('palette:open'))}
        />
      </div>
    </div>
  );
};

interface TabButtonProps {
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, active, badge, onClick }) => (
  <button
    onClick={onClick}
    className={`
      px-3 py-1.5 text-sm font-medium rounded transition-colors relative
      ${active
        ? 'bg-acc text-white'
        : 'text-text-pri hover:bg-panel'
      }
    `}
  >
    {label}
    {badge && badge > 0 && (
      <span className="absolute top-0 right-0 min-w-[20px] h-5 bg-danger rounded-full text-white text-xs flex items-center justify-center -translate-y-2 translate-x-1/2">
        {badge}
      </span>
    )}
  </button>
);

interface ToolbarButtonProps {
  icon: React.ComponentType<{ size: number }>;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon: Icon,
  label,
  shortcut,
  onClick
}) => (
  <button
    onClick={onClick}
    className="
      p-1.5 rounded hover:bg-panel transition-colors
      flex items-center gap-2
    "
    title={shortcut ? `${label} (${shortcut})` : label}
  >
    <Icon size={16} className="text-text-pri" />
  </button>
);
```

---

## Sidebar Component

**File:** `bough/frontend/src/components/Sidebar.tsx`

Collapsible sections for Branches, Remotes, Tags, Stashes, Worktrees.

```typescript
import React, { useState } from 'react';
import { ChevronRight, GitBranch, Github, Tag, Archive, Layers } from 'lucide-react';
import { useBranches } from '../hooks/useBranches';
import { useWorktrees } from '../hooks/useWorktrees';

export const Sidebar: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState({
    branches: true,
    remotes: true,
    tags: false,
    stashes: false,
    worktrees: true,
  });

  const { data: branches } = useBranches();
  const { data: worktrees } = useWorktrees();

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <aside className="w-50 bg-sidebar border-r border-slate-200 dark:border-slate-800 overflow-y-auto flex flex-col">
      {/* Branches */}
      <SidebarSection
        title="Branches"
        icon={GitBranch}
        expanded={expandedSections.branches}
        onToggle={() => toggleSection('branches')}
        onAdd={() => {}}
      >
        {branches?.local?.map(branch => (
          <SidebarItem key={branch} label={branch} />
        ))}
      </SidebarSection>

      {/* Remotes */}
      <SidebarSection
        title="Remotes"
        icon={Github}
        expanded={expandedSections.remotes}
        onToggle={() => toggleSection('remotes')}
      >
        {branches?.remotes?.map(remote => (
          <SidebarItem key={remote} label={remote} />
        ))}
      </SidebarSection>

      {/* Tags */}
      <SidebarSection
        title="Tags"
        icon={Tag}
        expanded={expandedSections.tags}
        onToggle={() => toggleSection('tags')}
      >
        {/* Tags list */}
      </SidebarSection>

      {/* Stashes */}
      <SidebarSection
        title="Stashes"
        icon={Archive}
        expanded={expandedSections.stashes}
        onToggle={() => toggleSection('stashes')}
      >
        {/* Stash list */}
      </SidebarSection>

      {/* Worktrees */}
      <SidebarSection
        title="Worktrees"
        icon={Layers}
        expanded={expandedSections.worktrees}
        onToggle={() => toggleSection('worktrees')}
        onAdd={() => {}}
      >
        {worktrees?.map(wt => (
          <WorktreeItem key={wt.path} worktree={wt} />
        ))}
      </SidebarSection>
    </aside>
  );
};

interface SidebarSectionProps {
  title: string;
  icon: React.ComponentType<{ size: number }>;
  expanded: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  children: React.ReactNode;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  icon: Icon,
  expanded,
  onToggle,
  onAdd,
  children
}) => (
  <div className="flex flex-col">
    <button
      onClick={onToggle}
      className="
        h-8 px-3 flex items-center gap-2 hover:bg-panel
        transition-colors text-sm font-semibold text-text-pri
      "
    >
      <ChevronRight
        size={14}
        className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
      />
      <Icon size={14} />
      <span>{title}</span>
      {onAdd && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="ml-auto p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded"
        >
          +
        </button>
      )}
    </button>
    {expanded && (
      <div className="flex flex-col pl-4">
        {children}
      </div>
    )}
  </div>
);

interface SidebarItemProps {
  label: string;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ label }) => (
  <div className="h-6 px-2 flex items-center text-xs text-text-sec hover:bg-panel cursor-pointer transition-colors">
    {label}
  </div>
);

interface WorktreeItem {
  path: string;
  branch: string;
  isDirty: boolean;
}

const WorktreeItem: React.FC<{ worktree: WorktreeItem }> = ({ worktree }) => (
  <div className="h-6 px-2 flex items-center gap-1 text-xs text-text-sec hover:bg-panel cursor-pointer transition-colors">
    <Layers size={12} />
    <span className="truncate flex-1 font-mono">
      {worktree.path.split('/').pop()}
    </span>
    {worktree.isDirty && (
      <span className="w-2 h-2 rounded-full bg-warn flex-shrink-0" />
    )}
  </div>
);
```

---

## Flash Notification Component

**File:** `bough/frontend/src/components/FlashNotification.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const FlashNotification: React.FC = () => {
  const { notification, clearNotification } = useAppStore();

  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => {
      clearNotification();
    }, 4000);

    return () => clearTimeout(timer);
  }, [notification, clearNotification]);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className={`
            fixed bottom-6 left-1/2 -translate-x-1/2
            px-4 py-3 rounded-lg flex items-center gap-3
            shadow-lg text-white text-sm font-medium
            ${notification.type === 'success' ? 'bg-success' : ''}
            ${notification.type === 'error' ? 'bg-danger' : ''}
            ${notification.type === 'warning' ? 'bg-warn' : ''}
            ${notification.type === 'info' ? 'bg-acc' : ''}
          `}
        >
          {notification.type === 'success' && <CheckCircle2 size={18} />}
          {notification.type === 'error' && <AlertCircle size={18} />}
          {notification.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

---

## Command Palette Component

**File:** `bough/frontend/src/components/CommandPalette.tsx`

```typescript
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';

const COMMANDS = [
  { label: 'New Branch', shortcut: '⌘B', action: 'new-branch' },
  { label: 'Fetch', shortcut: '⌘F', action: 'fetch' },
  { label: 'Pull', shortcut: '⌘L', action: 'pull' },
  { label: 'Push', shortcut: '⌘P', action: 'push' },
  { label: 'Commit', shortcut: '⌘Enter', action: 'commit' },
  { label: 'Stash', shortcut: '⌘S', action: 'stash' },
  { label: 'Settings', shortcut: '⌘,', action: 'settings' },
];

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('palette:open', handleOpen);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('palette:open', handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const filteredCommands = useMemo(() => {
    if (!search) return COMMANDS;
    return COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-96 bg-panel rounded-lg shadow-2xl overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <Search size={18} className="text-text-ter" />
              <input
                autoFocus
                type="text"
                placeholder="Search commands..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-text-pri outline-none text-sm"
              />
            </div>

            {/* Command list */}
            <div className="max-h-72 overflow-y-auto">
              {filteredCommands.map((cmd, idx) => (
                <button
                  key={cmd.action}
                  onClick={() => {
                    // Execute command
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`
                    w-full px-4 py-3 text-left text-sm
                    hover:bg-slate-200 dark:hover:bg-slate-800
                    ${idx === 0 ? 'bg-slate-100 dark:bg-slate-900' : ''}
                    flex items-center justify-between
                  `}
                >
                  <span className="text-text-pri">{cmd.label}</span>
                  <span className="text-xs text-text-ter font-mono">
                    {cmd.shortcut}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

---

## Zustand Store

**File:** `bough/frontend/src/store/appStore.ts`

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Notification {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface WorktreeInfo {
  path: string;
  branch: string;
  isDirty: boolean;
}

interface AppStore {
  // Theme
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  // View state
  activeView: 'history' | 'changes';
  setActiveView: (view: 'history' | 'changes') => void;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;

  // Repository
  activeRepo: string | null;
  setActiveRepo: (repo: string) => void;

  // Commit selection
  selectedCommit: string | null;
  setSelectedCommit: (hash: string) => void;

  // File selection (in diff view)
  selectedFile: string | null;
  setSelectedFile: (path: string) => void;

  // Worktrees
  worktrees: WorktreeInfo[];
  setWorktrees: (wts: WorktreeInfo[]) => void;
  activeWorktree: string | null;
  setActiveWorktree: (path: string) => void;

  // Notifications
  notification: Notification | null;
  showNotification: (notification: Notification) => void;
  clearNotification: () => void;
}

export const useAppStore = create<AppStore>()(
  devtools((set) => ({
    theme: localStorage.getItem('theme') as 'light' | 'dark' ?? 'light',
    setTheme: (theme) => {
      localStorage.setItem('theme', theme);
      set({ theme });
    },

    activeView: 'history',
    setActiveView: (activeView) => set({ activeView }),
    showSidebar: true,
    setShowSidebar: (showSidebar) => set({ showSidebar }),

    activeRepo: null,
    setActiveRepo: (activeRepo) => set({ activeRepo }),

    selectedCommit: null,
    setSelectedCommit: (selectedCommit) => set({ selectedCommit }),

    selectedFile: null,
    setSelectedFile: (selectedFile) => set({ selectedFile }),

    worktrees: [],
    setWorktrees: (worktrees) => set({ worktrees }),
    activeWorktree: null,
    setActiveWorktree: (activeWorktree) => set({ activeWorktree }),

    notification: null,
    showNotification: (notification) => set({ notification }),
    clearNotification: () => set({ notification: null }),
  }))
);
```

---

## Custom Hooks

**File:** `bough/frontend/src/hooks/useStatus.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GetStatus } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime';
import { useEffect } from 'react';

export const useStatus = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['status'],
    queryFn: GetStatus,
    staleTime: 10000,
  });

  useEffect(() => {
    const unsubscribe = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    });
    return unsubscribe;
  }, [queryClient]);

  return query;
};
```

**File:** `bough/frontend/src/hooks/useBranches.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { ListBranches } from '../wailsjs/go/main/App';

export const useBranches = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: ListBranches,
    staleTime: 30000,
  });
};
```

**File:** `bough/frontend/src/hooks/useWorktrees.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListWorktrees, AddWorktree as AddWorktreeAPI } from '../wailsjs/go/main/App';

export const useWorktrees = () => {
  const queryClient = useQueryClient();

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

  return { ...query, addMutation };
};
```

---

## Global Keyboard Hook

**File:** `bough/frontend/src/hooks/useKeyboard.ts`

```typescript
import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export const useKeyboard = () => {
  const { setActiveView, activeView } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K: Open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('palette:open'));
      }

      // ⌘1: Switch to History
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        setActiveView('history');
      }

      // ⌘2: Switch to Changes
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        setActiveView('changes');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveView]);
};
```

---

## Verification Checklist

- [ ] App.tsx renders all major sections (Titlebar, Toolbar, Sidebar, Views)
- [ ] Theme toggle persists to localStorage
- [ ] Query invalidation works on 'repo:changed' event
- [ ] Command palette opens with ⌘K and Escape closes it
- [ ] Tab switching updates activeView in store
- [ ] Sidebar collapses/expands sections
- [ ] Flash notifications display with correct duration
- [ ] Keyboard shortcuts j/k work in commit list
- [ ] Worktree list displays with dirty indicator
- [ ] Branch chip colors match commit graph colors
- [ ] All TypeScript types compile without errors
- [ ] Tailwind classes apply correctly (light/dark mode)

---

## CSS Custom Properties (to configure in globals.css)

```css
:root {
  --bg-content: #ffffff;
  --bg-sidebar: #f3f4f6;
  --bg-panel: #e5e7eb;
  --acc: #0066CC;
  --text-pri: #1f2937;
  --text-sec: #6b7280;
  --text-ter: #9ca3af;
  --success: #00875a;
  --danger: #d92d20;
  --warn: #c4680a;
  --bg-add: #d1fae5;
  --bg-del: #fee2e2;
  --bg-hunk: #fef3c7;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-content: #1f2937;
    --bg-sidebar: #111827;
    --bg-panel: #374151;
    --acc: #0a84ff;
    --text-pri: #f3f4f6;
    --text-sec: #d1d5db;
    --text-ter: #9ca3af;
  }
}
```

---

## Implementation Order

1. Create Zustand store (appStore.ts)
2. Implement Titlebar (frameless, theme toggle)
3. Implement Toolbar (repo selector, view tabs, badges)
4. Create custom hooks (useStatus, useBranches, useWorktrees)
5. Build Sidebar with collapsible sections
6. Implement FlashNotification with animation
7. Create CommandPalette modal
8. Wire up global keyboard shortcuts (useKeyboard)
9. Integrate all components into App.tsx
10. Test with real repository and verify query invalidation
