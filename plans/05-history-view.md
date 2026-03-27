# Implementation Plan: History View

## Overview
The History View displays the commit log as a DAG with a detail panel showing commit metadata and file changes. Layout: GitCanvas (flex:1) on left, DetailPanel (370px) on right.

---

## HistoryView Container

**File:** `bough/frontend/src/views/HistoryView.tsx`

```typescript
import React, { useState, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { CommitList } from '../components/CommitList';
import { CommitDetailPanel } from '../components/CommitDetailPanel';

export const HistoryView: React.FC = () => {
  const { selectedCommit, setSelectedCommit, showSidebar } = useAppStore();
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectCommit = useCallback((hash: string) => {
    setSelectedCommit(hash);
  }, [setSelectedCommit]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="h-10 bg-panel border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-3">
        <input
          type="text"
          placeholder="Search commits..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="
            flex-1 bg-content text-text-pri text-sm outline-none
            px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700
            focus:border-acc focus:ring-1 focus:ring-acc
          "
        />
        <label className="flex items-center gap-2 text-xs text-text-sec">
          <input
            type="checkbox"
            checked={showAllBranches}
            onChange={(e) => setShowAllBranches(e.target.checked)}
            className="rounded"
          />
          All Branches
        </label>
      </div>

      {/* Main content: commit list + detail panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Commit list with graph canvas */}
        <CommitList
          onSelectCommit={handleSelectCommit}
          selectedHash={selectedCommit}
          showAllBranches={showAllBranches}
          searchQuery={searchQuery}
        />

        {/* Detail panel */}
        {selectedCommit && (
          <CommitDetailPanel commitHash={selectedCommit} />
        )}
      </div>
    </div>
  );
};
```

---

## CommitDetailPanel Component

**File:** `bough/frontend/src/components/CommitDetailPanel.tsx`

```typescript
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GetCommitDetail } from '../wailsjs/go/main/App';
import { CommitNode } from '../types';
import { FileList } from './FileList';
import { DiffViewer } from './DiffViewer';
import { Copy, ExternalLink } from 'lucide-react';

interface CommitDetailPanelProps {
  commitHash: string;
}

export const CommitDetailPanel: React.FC<CommitDetailPanelProps> = ({
  commitHash
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'diff'>('files');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const { data: commit, isLoading } = useQuery({
    queryKey: ['commit', commitHash],
    queryFn: async () => {
      const result = await GetCommitDetail(commitHash);
      return result as CommitNode;
    },
    staleTime: Infinity,
  });

  if (isLoading || !commit) {
    return <div className="w-[370px] bg-panel border-l border-slate-200 dark:border-slate-800 flex items-center justify-center">
      Loading...
    </div>;
  }

  return (
    <div className="w-[370px] bg-panel border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
      {/* Header section */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800 p-4 space-y-3">
        {/* Hash pill */}
        <div className="flex items-center gap-2">
          <code className="
            flex-1 px-2 py-1.5 bg-content rounded text-xs font-mono font-bold
            text-text-ter
          ">
            {commit.hash}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(commit.hash);
            }}
            className="p-1.5 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors"
            title="Copy hash"
          >
            <Copy size={14} className="text-text-ter" />
          </button>
        </div>

        {/* Commit message (full text) */}
        <div>
          <p className="text-sm font-semibold text-text-pri leading-snug">
            {commit.message}
          </p>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-text-ter block">Author</span>
            <span className="text-text-pri font-medium">{commit.author}</span>
          </div>
          <div>
            <span className="text-text-ter block">Email</span>
            <span className="text-text-pri font-mono text-[11px]">{commit.email}</span>
          </div>
          <div className="col-span-2">
            <span className="text-text-ter block">Date</span>
            <span className="text-text-pri font-mono">
              {new Date(commit.date).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Parent links */}
        {commit.parents && commit.parents.length > 0 && (
          <div>
            <span className="text-text-ter text-xs block mb-1">Parents</span>
            <div className="flex flex-col gap-1">
              {commit.parents.map((parent, idx) => (
                <code
                  key={idx}
                  className="
                    px-2 py-1 bg-content rounded text-xs font-mono
                    text-acc hover:underline cursor-pointer
                  "
                >
                  {parent.substring(0, 7)}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-content">
        <TabButton
          label="Files"
          active={activeTab === 'files'}
          onClick={() => setActiveTab('files')}
        />
        <TabButton
          label="Diff"
          active={activeTab === 'diff'}
          onClick={() => setActiveTab('diff')}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && (
          <FileList
            commitHash={commitHash}
            onSelectFile={setSelectedFile}
            selectedFile={selectedFile}
          />
        )}
        {activeTab === 'diff' && selectedFile && (
          <DiffViewer
            commitHash={commitHash}
            filePath={selectedFile}
          />
        )}
      </div>
    </div>
  );
};

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`
      px-3 py-1.5 text-xs font-medium rounded transition-colors
      ${active
        ? 'bg-acc text-white'
        : 'text-text-sec hover:bg-slate-200 dark:hover:bg-slate-800'
      }
    `}
  >
    {label}
  </button>
);
```

---

## FileList Component

**File:** `bough/frontend/src/components/FileList.tsx`

```typescript
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { GetCommitFiles } from '../wailsjs/go/main/App';
import { DiffFile } from '../types';
import { FileIcon, Plus, Minus } from 'lucide-react';

interface FileListProps {
  commitHash: string;
  onSelectFile: (path: string) => void;
  selectedFile: string | null;
}

export const FileList: React.FC<FileListProps> = ({
  commitHash,
  onSelectFile,
  selectedFile
}) => {
  const { data: files = [] } = useQuery({
    queryKey: ['commit-files', commitHash],
    queryFn: async () => {
      const result = await GetCommitFiles(commitHash);
      return (result || []) as DiffFile[];
    },
    staleTime: Infinity,
  });

  const totalAdded = files.reduce((acc, f) => {
    const added = f.hunks?.reduce((h, hunk) =>
      h + (hunk.lines?.filter(l => l.type === 'add').length || 0), 0
    ) || 0;
    return acc + added;
  }, 0);

  const totalRemoved = files.reduce((acc, f) => {
    const removed = f.hunks?.reduce((h, hunk) =>
      h + (hunk.lines?.filter(l => l.type === 'del').length || 0), 0
    ) || 0;
    return acc + removed;
  }, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats */}
      <div className="flex-shrink-0 px-4 py-2 bg-content border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 text-xs">
        <span className="text-text-sec">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
        <span className="text-success font-semibold flex items-center gap-1">
          <Plus size={12} /> {totalAdded}
        </span>
        <span className="text-danger font-semibold flex items-center gap-1">
          <Minus size={12} /> {totalRemoved}
        </span>
      </div>

      {/* File rows */}
      <div className="flex-1 overflow-y-auto">
        {files.map((file) => (
          <FileRow
            key={file.path}
            file={file}
            selected={file.path === selectedFile}
            onSelect={() => onSelectFile(file.path)}
          />
        ))}
      </div>
    </div>
  );
};

interface FileRowProps {
  file: DiffFile;
  selected: boolean;
  onSelect: () => void;
}

const FileRow: React.FC<FileRowProps> = ({ file, selected, onSelect }) => {
  const addCount = file.hunks?.reduce((acc, hunk) =>
    acc + (hunk.lines?.filter(l => l.type === 'add').length || 0), 0
  ) || 0;

  const delCount = file.hunks?.reduce((acc, hunk) =>
    acc + (hunk.lines?.filter(l => l.type === 'del').length || 0), 0
  ) || 0;

  return (
    <div
      onClick={onSelect}
      className={`
        px-3 py-2 flex items-center gap-2 cursor-pointer
        border-b border-slate-100 dark:border-slate-900
        hover:bg-slate-100 dark:hover:bg-slate-800
        ${selected ? 'bg-slate-200 dark:bg-slate-700' : ''}
        transition-colors
      `}
    >
      <FileIcon size={14} className="text-text-ter flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-text-pri truncate">
          {file.path}
        </p>
      </div>
      <div className="flex items-center gap-1 text-xs whitespace-nowrap flex-shrink-0">
        {addCount > 0 && (
          <span className="text-success font-semibold">+{addCount}</span>
        )}
        {delCount > 0 && (
          <span className="text-danger font-semibold">-{delCount}</span>
        )}
      </div>
    </div>
  );
};
```

---

## DiffViewer Component (Monaco Editor)

**File:** `bough/frontend/src/components/DiffViewer.tsx`

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GetFileAtCommit, GetFileAtCommitParent } from '../wailsjs/go/main/App';
import { useAppStore } from '../store/appStore';
import * as monaco from 'monaco-editor';

interface DiffViewerProps {
  commitHash: string;
  filePath: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  commitHash,
  filePath
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const { theme } = useAppStore();

  const { data: currentContent } = useQuery({
    queryKey: ['file-at-commit', commitHash, filePath],
    queryFn: async () => {
      const result = await GetFileAtCommit(commitHash, filePath);
      return result || '';
    },
    staleTime: Infinity,
  });

  const { data: parentContent } = useQuery({
    queryKey: ['file-at-parent', commitHash, filePath],
    queryFn: async () => {
      const result = await GetFileAtCommitParent(commitHash, filePath);
      return result || '';
    },
    staleTime: Infinity,
  });

  // Detect file language from extension
  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'jsx': 'javascript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'java': 'java',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'html': 'html',
      'css': 'css',
      'sql': 'sql',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  const language = getLanguageFromPath(filePath);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize diff editor
    if (!diffEditorRef.current) {
      diffEditorRef.current = monaco.editor.createDiffEditor(
        containerRef.current,
        {
          theme: theme === 'dark' ? 'vs-dark' : 'vs',
          renderSideBySide: true,
          readOnly: true,
          originalEditable: false,
          glyphMargin: true,
          lineNumbers: 'on',
          minimap: { enabled: true },
          wordWrap: 'on',
        }
      );
    } else {
      diffEditorRef.current.updateOptions({
        theme: theme === 'dark' ? 'vs-dark' : 'vs',
      });
    }

    // Set editor content
    const originalModel = monaco.editor.createModel(
      parentContent || '',
      language,
      monaco.Uri.parse('file:///parent')
    );
    const modifiedModel = monaco.editor.createModel(
      currentContent || '',
      language,
      monaco.Uri.parse('file:///current')
    );

    diffEditorRef.current.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    return () => {
      originalModel.dispose();
      modifiedModel.dispose();
    };
  }, [currentContent, parentContent, theme, language]);

  return (
    <div ref={containerRef} className="h-full w-full" />
  );
};
```

---

## TypeScript Types

**File:** `bough/frontend/src/types/index.ts` (relevant excerpts)

```typescript
export interface CommitNode {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string; // ISO timestamp
  parents: string[];
  refs: string[]; // Branch/tag references
  column: number;
  color: number;
  lines: GraphLine[];
}

export interface GraphLine {
  fromCol: number;
  toCol: number;
  color: number;
  isMerge: boolean;
}

export interface DiffFile {
  path: string;
  oldPath?: string;
  hunks: DiffHunk[];
  binary: boolean;
}

export interface DiffHunk {
  header: string; // e.g., "@@ -10,5 +12,8 @@"
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'del' | 'ctx'; // context
  content: string;
  oldNo?: number;
  newNo?: number;
}
```

---

## Go Backend Integration

**File:** `bough/git/app.go` (methods to implement)

```go
// GetCommitDetail returns detailed information for a single commit
func (a *App) GetCommitDetail(ctx context.Context, hash string) (*CommitNode, error) {
  // Implementation
  return nil, nil
}

// GetCommitFiles returns all files changed in a commit
func (a *App) GetCommitFiles(ctx context.Context, commitHash string) ([]DiffFile, error) {
  // Implementation
  return nil, nil
}

// GetFileAtCommit returns file content at specific commit
func (a *App) GetFileAtCommit(ctx context.Context, commitHash, filePath string) (string, error) {
  // Implementation
  return "", nil
}

// GetFileAtCommitParent returns file content at parent commit
func (a *App) GetFileAtCommitParent(ctx context.Context, commitHash, filePath string) (string, error) {
  // Implementation
  return "", nil
}
```

---

## Styling with Tailwind CSS

Add these custom utilities to `globals.css`:

```css
.commit-detail-metadata {
  @apply grid grid-cols-2 gap-2 text-xs;
}

.file-list-item {
  @apply px-3 py-2 flex items-center gap-2 cursor-pointer
    border-b border-slate-100 dark:border-slate-900
    hover:bg-slate-100 dark:hover:bg-slate-800
    transition-colors;
}

.diff-stats {
  @apply flex items-center gap-3 text-xs;
}

.stat-badge {
  @apply font-semibold flex items-center gap-1;
}

.stat-added {
  @apply text-success;
}

.stat-removed {
  @apply text-danger;
}
```

---

## Search Implementation (Client-side)

Enhance CommitList to filter by search:

```typescript
export interface CommitListProps {
  onSelectCommit: (hash: string) => void;
  selectedHash?: string;
  showAllBranches: boolean;
  searchQuery: string;
}

export const CommitList: React.FC<CommitListProps> = ({
  searchQuery,
  // ... other props
}) => {
  const { data: allCommits = [] } = useCommits(500, showAllBranches);

  const filteredCommits = useMemo(() => {
    if (!searchQuery) return allCommits;

    const query = searchQuery.toLowerCase();
    return allCommits.filter(commit =>
      commit.hash.toLowerCase().includes(query) ||
      commit.message.toLowerCase().includes(query) ||
      commit.author.toLowerCase().includes(query)
    );
  }, [allCommits, searchQuery]);

  // ... rest of implementation
};
```

---

## Verification Checklist

- [ ] Commit detail panel displays all metadata
- [ ] Hash copy-to-clipboard works
- [ ] File list shows correct +/- stats
- [ ] Clicking file opens diff viewer
- [ ] Monaco diff editor renders with correct theme
- [ ] Language detection works for common file types
- [ ] Parent commit file content loads correctly
- [ ] Search filters commits by hash/message/author
- [ ] All Branches toggle shows/hides non-local commits
- [ ] Tab switching (Files/Diff) works smoothly
- [ ] No console errors in Monaco editor
- [ ] Diff viewer responsive to window resize
- [ ] Query caching works (don't refetch on tab switch)

---

## Implementation Order

1. Define TypeScript types (DiffFile, DiffHunk, DiffLine, etc.)
2. Implement Go backend methods (GetCommitDetail, GetCommitFiles, GetFileAt*)
3. Build FileList component with file row styling
4. Integrate Monaco editor for DiffViewer
5. Implement CommitDetailPanel with tabs
6. Add search bar with client-side filtering
7. Test with real repository commits
8. Optimize Monaco performance (syntax highlighting, large diffs)
9. Add keyboard shortcuts (e.g., open diff in new window)
10. Polish styling and animations
