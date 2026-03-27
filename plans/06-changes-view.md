# Implementation Plan: Changes View

## Overview
The Changes View is a staging interface with two sections: unstaged and staged files. Layout: FileStatusList (240px) on left, ChunkDiff (flex:1) on right. Commit box at bottom of detail section.

---

## ChangesView Container

**File:** `bough/frontend/src/views/ChangesView.tsx`

```typescript
import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { FileStatusList } from '../components/FileStatusList';
import { ChunkDiffPanel } from '../components/ChunkDiffPanel';
import { CommitBox } from '../components/CommitBox';

export const ChangesView: React.FC = () => {
  const { selectedFile, setSelectedFile } = useAppStore();
  const [selectedHunk, setSelectedHunk] = useState<number | null>(null);

  return (
    <div className="flex h-full overflow-hidden">
      {/* File status list (240px, left) */}
      <FileStatusList
        selectedFile={selectedFile}
        onSelectFile={setSelectedFile}
      />

      {/* Chunk diff panel (flex:1, right) */}
      <div className="flex-1 flex flex-col overflow-hidden bg-content">
        {selectedFile ? (
          <>
            {/* Diff viewer */}
            <ChunkDiffPanel
              filePath={selectedFile}
              selectedHunk={selectedHunk}
              onSelectHunk={setSelectedHunk}
            />

            {/* Commit box (at bottom) */}
            <CommitBox />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-ter">
            <span className="text-sm">Select a file to view changes</span>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## FileStatusList Component

**File:** `bough/frontend/src/components/FileStatusList.tsx`

```typescript
import React, { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GetStatus, StageFile, UnstageFile } from '../wailsjs/go/main/App';
import { FileStatus } from '../types';
import { File, Plus, Minus, Copy } from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface FileStatusListProps {
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

export const FileStatusList: React.FC<FileStatusListProps> = ({
  selectedFile,
  onSelectFile
}) => {
  const queryClient = useQueryClient();
  const { showNotification } = useAppStore();

  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: GetStatus,
    staleTime: 10000,
  });

  const stageFileMutation = useMutation({
    mutationFn: (path: string) => StageFile(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
      showNotification({
        message: 'File staged',
        type: 'success'
      });
    },
    onError: (error: Error) => {
      showNotification({
        message: `Failed to stage: ${error.message}`,
        type: 'error'
      });
    }
  });

  const unstageFileMutation = useMutation({
    mutationFn: (path: string) => UnstageFile(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
      showNotification({
        message: 'File unstaged',
        type: 'success'
      });
    },
    onError: (error: Error) => {
      showNotification({
        message: `Failed to unstage: ${error.message}`,
        type: 'error'
      });
    }
  });

  const unstagedFiles = status?.files?.filter(f => f.unstaged) || [];
  const stagedFiles = status?.files?.filter(f => f.staged) || [];

  return (
    <div className="w-60 bg-sidebar border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
      {/* Unstaged section */}
      <div className="flex-1 flex flex-col min-h-0 border-b border-slate-200 dark:border-slate-800">
        <SectionHeader
          title="Unstaged Changes"
          count={unstagedFiles.length}
          onStageAll={() => {
            unstagedFiles.forEach(f => stageFileMutation.mutate(f.path));
          }}
        />
        <div className="flex-1 overflow-y-auto">
          {unstagedFiles.map(file => (
            <FileStatusRow
              key={file.path}
              file={file}
              selected={file.path === selectedFile}
              onSelect={() => onSelectFile(file.path)}
              onStage={() => stageFileMutation.mutate(file.path)}
            />
          ))}
        </div>
      </div>

      {/* Staged section */}
      <div className="flex-1 flex flex-col min-h-0">
        <SectionHeader
          title="Staged Changes"
          count={stagedFiles.length}
          onUnstageAll={() => {
            stagedFiles.forEach(f => unstageFileMutation.mutate(f.path));
          }}
        />
        <div className="flex-1 overflow-y-auto">
          {stagedFiles.map(file => (
            <FileStatusRow
              key={file.path}
              file={file}
              selected={file.path === selectedFile}
              onSelect={() => onSelectFile(file.path)}
              onUnstage={() => unstageFileMutation.mutate(file.path)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface SectionHeaderProps {
  title: string;
  count: number;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  count,
  onStageAll,
  onUnstageAll
}) => (
  <div className="flex-shrink-0 h-8 px-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
    <span className="text-xs font-semibold text-text-pri">
      {title}
      <span className="text-text-ter ml-1">({count})</span>
    </span>
    {onStageAll && (
      <button
        onClick={onStageAll}
        className="text-xs font-medium text-acc hover:underline whitespace-nowrap"
      >
        Stage All
      </button>
    )}
    {onUnstageAll && (
      <button
        onClick={onUnstageAll}
        className="text-xs font-medium text-acc hover:underline whitespace-nowrap"
      >
        Unstage All
      </button>
    )}
  </div>
);

interface FileStatusRowProps {
  file: FileStatus;
  selected: boolean;
  onSelect: () => void;
  onStage?: () => void;
  onUnstage?: () => void;
}

const FileStatusRow: React.FC<FileStatusRowProps> = ({
  file,
  selected,
  onSelect,
  onStage,
  onUnstage
}) => {
  const statusLabel = file.added ? 'A' : file.deleted ? 'D' : 'M';
  const statusColor = file.added
    ? 'bg-success'
    : file.deleted
    ? 'bg-danger'
    : 'bg-warn';

  return (
    <div
      className={`
        px-3 py-2 flex items-center gap-2 cursor-pointer
        border-b border-slate-100 dark:border-slate-900
        hover:bg-slate-200 dark:hover:bg-slate-800
        ${selected ? 'bg-slate-300 dark:bg-slate-700' : ''}
        group transition-colors
      `}
      onClick={onSelect}
    >
      {/* Status badge */}
      <div className={`
        w-6 h-6 rounded flex items-center justify-center
        text-white text-xs font-bold flex-shrink-0
        ${statusColor}
      `}>
        {statusLabel}
      </div>

      {/* Filename */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-text-pri truncate">
          {file.path}
        </p>
        {file.oldPath && file.oldPath !== file.path && (
          <p className="text-xs text-text-ter truncate">
            (from {file.oldPath})
          </p>
        )}
      </div>

      {/* Stage/unstage button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onStage) onStage();
          if (onUnstage) onUnstage();
        }}
        className="
          opacity-0 group-hover:opacity-100 p-1
          hover:bg-slate-400 dark:hover:bg-slate-600 rounded
          transition-opacity
        "
        title={onStage ? 'Stage file' : 'Unstage file'}
      >
        {onStage ? (
          <Plus size={14} className="text-success" />
        ) : (
          <Minus size={14} className="text-danger" />
        )}
      </button>
    </div>
  );
};
```

---

## ChunkDiffPanel Component

**File:** `bough/frontend/src/components/ChunkDiffPanel.tsx`

```typescript
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { GetFileDiff } from '../wailsjs/go/main/App';
import { DiffFile, DiffHunk } from '../types';
import { HunkBlock } from './HunkBlock';
import { Minus, Plus } from 'lucide-react';

interface ChunkDiffPanelProps {
  filePath: string;
  selectedHunk: number | null;
  onSelectHunk: (idx: number | null) => void;
}

export const ChunkDiffPanel: React.FC<ChunkDiffPanelProps> = ({
  filePath,
  selectedHunk,
  onSelectHunk
}) => {
  const { data: diffFile, isLoading } = useQuery({
    queryKey: ['diff', filePath],
    queryFn: async () => {
      const result = await GetFileDiff(filePath);
      return result as DiffFile;
    },
  });

  if (isLoading || !diffFile) {
    return <div className="flex-1 flex items-center justify-center">Loading diff...</div>;
  }

  if (diffFile.binary) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-ter">
        <span>Binary file (cannot display diff)</span>
      </div>
    );
  }

  const totalAdded = diffFile.hunks?.reduce((acc, h) =>
    acc + (h.lines?.filter(l => l.type === 'add').length || 0), 0
  ) || 0;

  const totalRemoved = diffFile.hunks?.reduce((acc, h) =>
    acc + (h.lines?.filter(l => l.type === 'del').length || 0), 0
  ) || 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* File header */}
      <div className="flex-shrink-0 bg-panel border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold text-text-pri">
            {filePath}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-success font-semibold flex items-center gap-1">
            <Plus size={12} /> {totalAdded}
          </span>
          <span className="text-danger font-semibold flex items-center gap-1">
            <Minus size={12} /> {totalRemoved}
          </span>
        </div>
      </div>

      {/* Hunks scroll area */}
      <div className="flex-1 overflow-y-auto bg-content">
        {(diffFile.hunks || []).map((hunk, idx) => (
          <HunkBlock
            key={idx}
            hunk={hunk}
            hunkIndex={idx}
            filePath={filePath}
            isSelected={selectedHunk === idx}
            onSelect={() => onSelectHunk(idx)}
          />
        ))}
      </div>
    </div>
  );
};
```

---

## HunkBlock Component

**File:** `bough/frontend/src/components/HunkBlock.tsx`

```typescript
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StageHunk, UnstageHunk, DiscardHunk } from '../wailsjs/go/main/App';
import { DiffHunk, DiffLine } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { buildHunkPatch } from '../utils/diffUtils';

interface HunkBlockProps {
  hunk: DiffHunk;
  hunkIndex: number;
  filePath: string;
  isSelected: boolean;
  onSelect: () => void;
}

export const HunkBlock: React.FC<HunkBlockProps> = ({
  hunk,
  hunkIndex,
  filePath,
  isSelected,
  onSelect
}) => {
  const queryClient = useQueryClient();
  const { showNotification } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);

  const stageHunkMutation = useMutation({
    mutationFn: async () => {
      const patch = buildHunkPatch(filePath, hunk);
      return StageHunk(filePath, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['diff', filePath] });
      showNotification({ message: 'Hunk staged', type: 'success' });
    },
    onError: (error: Error) => {
      showNotification({
        message: `Failed to stage hunk: ${error.message}`,
        type: 'error'
      });
    }
  });

  const unstageHunkMutation = useMutation({
    mutationFn: async () => {
      const patch = buildHunkPatch(filePath, hunk);
      return UnstageHunk(filePath, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['diff', filePath] });
      showNotification({ message: 'Hunk unstaged', type: 'success' });
    },
    onError: (error: Error) => {
      showNotification({
        message: `Failed to unstage hunk: ${error.message}`,
        type: 'error'
      });
    }
  });

  const discardHunkMutation = useMutation({
    mutationFn: async () => {
      const patch = buildHunkPatch(filePath, hunk);
      return DiscardHunk(filePath, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['diff', filePath] });
      showNotification({ message: 'Changes discarded', type: 'success' });
    },
    onError: (error: Error) => {
      showNotification({
        message: `Failed to discard: ${error.message}`,
        type: 'error'
      });
    }
  });

  return (
    <div className={`
      border-l-4 border-hunk
      ${isSelected ? 'bg-slate-100 dark:bg-slate-900' : ''}
    `}>
      {/* Hunk header */}
      <div className="bg-hunk hover:bg-yellow-300 dark:hover:bg-yellow-900 px-4 py-2 flex items-center gap-3 cursor-pointer transition-colors group"
        onClick={() => setIsExpanded(!isExpanded)}>
        <button className="text-text-ter">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {/* Hunk header text */}
        <code className="flex-1 text-xs font-mono text-text-sec">
          {hunk.header}
        </code>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <HunkActionButton
            label="↑ Stage"
            className="text-success hover:bg-green-200 dark:hover:bg-green-900"
            onClick={() => stageHunkMutation.mutate()}
            disabled={stageHunkMutation.isPending}
          />
          <HunkActionButton
            label="✕ Discard"
            className="text-danger hover:bg-red-200 dark:hover:bg-red-900"
            onClick={() => discardHunkMutation.mutate()}
            disabled={discardHunkMutation.isPending}
          />
          <HunkActionButton
            label="↓ Unstage"
            className="text-acc hover:bg-blue-200 dark:hover:bg-blue-900"
            onClick={() => unstageHunkMutation.mutate()}
            disabled={unstageHunkMutation.isPending}
          />
        </div>
      </div>

      {/* Hunk lines */}
      {isExpanded && (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {(hunk.lines || []).map((line, idx) => (
            <DiffLineRow
              key={idx}
              line={line}
              lineIndex={idx}
              filePath={filePath}
              hunkIndex={hunkIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface HunkActionButtonProps {
  label: string;
  className: string;
  onClick: () => void;
  disabled: boolean;
}

const HunkActionButton: React.FC<HunkActionButtonProps> = ({
  label,
  className,
  onClick,
  disabled
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      px-2 py-1 text-xs font-semibold rounded transition-colors
      ${className}
      disabled:opacity-50 disabled:cursor-not-allowed
    `}
  >
    {label}
  </button>
);

interface DiffLineRowProps {
  line: DiffLine;
  lineIndex: number;
  filePath: string;
  hunkIndex: number;
}

const DiffLineRow: React.FC<DiffLineRowProps> = ({
  line,
  lineIndex,
  filePath,
  hunkIndex
}) => {
  const [showLineAction, setShowLineAction] = useState(false);

  const getLineBackground = () => {
    if (line.type === 'add') return 'bg-add dark:bg-green-950';
    if (line.type === 'del') return 'bg-del dark:bg-red-950';
    return 'bg-content';
  };

  const getLinePrefix = () => {
    if (line.type === 'add') return '+';
    if (line.type === 'del') return '-';
    return ' ';
  };

  const getPrefixColor = () => {
    if (line.type === 'add') return 'text-success';
    if (line.type === 'del') return 'text-danger';
    return 'text-text-ter';
  };

  return (
    <div
      className={`
        flex items-stretch font-mono text-xs leading-5
        ${getLineBackground()}
        hover:bg-opacity-50 transition-colors
        group
      `}
      onMouseEnter={() => setShowLineAction(true)}
      onMouseLeave={() => setShowLineAction(false)}
    >
      {/* Line prefix (+ or -) */}
      <span className={`
        w-6 flex items-center justify-center flex-shrink-0
        ${getPrefixColor()}
        font-bold
      `}>
        {getLinePrefix()}
      </span>

      {/* Old line number */}
      <span className="w-12 text-right px-2 text-text-ter flex-shrink-0 border-r border-slate-300 dark:border-slate-700">
        {line.oldNo || ''}
      </span>

      {/* New line number */}
      <span className="w-12 text-right px-2 text-text-ter flex-shrink-0 border-r border-slate-300 dark:border-slate-700">
        {line.newNo || ''}
      </span>

      {/* Line content */}
      <span className="px-3 flex-1 text-text-pri whitespace-pre-wrap break-words">
        {line.content}
      </span>

      {/* Line-level action button (stage/discard individual lines) */}
      <LineActionButton
        show={showLineAction}
        type={line.type}
      />
    </div>
  );
};

interface LineActionButtonProps {
  show: boolean;
  type: 'add' | 'del' | 'ctx';
}

const LineActionButton: React.FC<LineActionButtonProps> = ({ show, type }) => {
  if (type === 'ctx' || !show) return null;

  return (
    <button
      className={`
        px-2 flex items-center justify-center opacity-0 group-hover:opacity-100
        transition-opacity
        ${type === 'add' ? 'text-success hover:bg-green-200 dark:hover:bg-green-900' : ''}
        ${type === 'del' ? 'text-danger hover:bg-red-200 dark:hover:bg-red-900' : ''}
      `}
      title={type === 'add' ? 'Stage line' : 'Discard line'}
    >
      {type === 'add' ? '↑' : '✕'}
    </button>
  );
};
```

---

## CommitBox Component

**File:** `bough/frontend/src/components/CommitBox.tsx`

```typescript
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Commit, AmendCommit } from '../wailsjs/go/main/App';
import { useAppStore } from '../store/appStore';

export const CommitBox: React.FC = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useAppStore();
  const [message, setMessage] = useState('');
  const [isAmend, setIsAmend] = useState(false);

  const commitMutation = useMutation({
    mutationFn: async (msg: string) => {
      if (isAmend) {
        return AmendCommit(msg);
      } else {
        return Commit(msg);
      }
    },
    onSuccess: () => {
      setMessage('');
      setIsAmend(false);
      queryClient.invalidateQueries({ queryKey: ['status'] });
      queryClient.invalidateQueries({ queryKey: ['commits'] });
      showNotification({
        message: isAmend ? 'Commit amended' : 'Changes committed',
        type: 'success'
      });
    },
    onError: (error: Error) => {
      showNotification({
        message: `Commit failed: ${error.message}`,
        type: 'error'
      });
    }
  });

  const isDisabled =
    !message.trim() ||
    message.length === 0 ||
    commitMutation.isPending;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isDisabled) {
        commitMutation.mutate(message);
      }
    }
  };

  return (
    <div className="flex-shrink-0 bg-panel border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
      {/* Commit message input */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe your changes..."
        className="
          w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700
          bg-content text-text-pri text-sm
          focus:border-acc focus:ring-1 focus:ring-acc
          outline-none resize-none
          font-mono
        "
        rows={4}
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-text-sec">
          <input
            type="checkbox"
            checked={isAmend}
            onChange={(e) => setIsAmend(e.target.checked)}
            className="rounded"
          />
          Amend last commit
        </label>

        <button
          onClick={() => commitMutation.mutate(message)}
          disabled={isDisabled}
          className={`
            ml-auto px-4 py-2 rounded text-sm font-semibold
            transition-colors
            ${isDisabled
              ? 'bg-slate-300 dark:bg-slate-700 text-text-ter cursor-not-allowed'
              : 'bg-acc text-white hover:bg-blue-700 active:bg-blue-900'
            }
          `}
        >
          {commitMutation.isPending ? 'Committing...' : 'Commit'}
        </button>
      </div>

      {/* Keyboard shortcut hint */}
      <p className="text-xs text-text-ter">
        Press <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono text-[10px]">⌘+Enter</kbd> to commit
      </p>
    </div>
  );
};
```

---

## Diff Utilities

**File:** `bough/frontend/src/utils/diffUtils.ts`

```typescript
import { DiffHunk } from '../types';

/**
 * buildHunkPatch constructs a minimal unified diff patch for a single hunk
 * suitable for git apply/patch commands.
 *
 * Format:
 * --- a/path/to/file
 * +++ b/path/to/file
 * @@ -oldStart,oldCount +newStart,newCount @@
 * (context/add/del lines)
 */
export function buildHunkPatch(filePath: string, hunk: DiffHunk): string {
  const lines: string[] = [];

  // Header
  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  // Hunk header
  lines.push(hunk.header);

  // Hunk lines (with proper prefix)
  for (const line of (hunk.lines || [])) {
    if (line.type === 'add') {
      lines.push(`+${line.content}`);
    } else if (line.type === 'del') {
      lines.push(`-${line.content}`);
    } else if (line.type === 'ctx') {
      lines.push(` ${line.content}`);
    }
  }

  // Trailing newline
  return lines.join('\n') + '\n';
}

/**
 * parseDiffHeader extracts metadata from a unified diff header
 * Returns: { oldPath, newPath, isNewFile, isDeletedFile }
 */
export function parseDiffHeader(header: string): {
  oldPath: string;
  newPath: string;
  isNewFile: boolean;
  isDeletedFile: boolean;
} {
  const oldPathMatch = header.match(/^--- a\/(.+)$/m);
  const newPathMatch = header.match(/^\+\+\+ b\/(.+)$/m);

  const oldPath = oldPathMatch ? oldPathMatch[1] : '';
  const newPath = newPathMatch ? newPathMatch[1] : '';

  const isNewFile = oldPath === '/dev/null';
  const isDeletedFile = newPath === '/dev/null';

  return {
    oldPath,
    newPath,
    isNewFile,
    isDeletedFile,
  };
}

/**
 * highlightDiffLine applies syntax coloring to diff lines
 * Returns: { highlighted: boolean, color: string }
 */
export function highlightDiffLine(type: 'add' | 'del' | 'ctx') {
  return {
    add: { bg: 'var(--bg-add)', text: '#00875a' },
    del: { bg: 'var(--bg-del)', text: '#d92d20' },
    ctx: { bg: 'transparent', text: 'inherit' },
  }[type];
}
```

---

## Go Backend Integration

**File:** `bough/git/app.go` (methods to implement)

```go
// GetStatus returns the working tree status
func (a *App) GetStatus(ctx context.Context) (*RepoStatus, error) {
  // Implementation
  return nil, nil
}

// GetFileDiff returns the diff for a specific file (staged + unstaged)
func (a *App) GetFileDiff(ctx context.Context, filePath string) (*DiffFile, error) {
  // Implementation
  return nil, nil
}

// StageFile adds a file to the index
func (a *App) StageFile(ctx context.Context, filePath string) error {
  // Implementation
  return nil
}

// UnstageFile removes a file from the index
func (a *App) UnstageFile(ctx context.Context, filePath string) error {
  // Implementation
  return nil
}

// StageHunk applies a partial patch to the index
func (a *App) StageHunk(ctx context.Context, filePath, patch string) error {
  // Implementation: git apply --cached < patch
  return nil
}

// UnstageHunk removes a patch from the index
func (a *App) UnstageHunk(ctx context.Context, filePath, patch string) error {
  // Implementation: git apply --cached --reverse < patch
  return nil
}

// DiscardHunk discards changes from working tree
func (a *App) DiscardHunk(ctx context.Context, filePath, patch string) error {
  // Implementation: git apply --reverse < patch
  return nil
}

// Commit creates a new commit with staged changes
func (a *App) Commit(ctx context.Context, message string) error {
  // Implementation: git commit -m message
  return nil
}

// AmendCommit amends the last commit
func (a *App) AmendCommit(ctx context.Context, message string) error {
  // Implementation: git commit --amend -m message
  return nil
}
```

---

## TypeScript Types

**File:** `bough/frontend/src/types/index.ts` (relevant excerpts)

```typescript
export interface FileStatus {
  path: string;
  oldPath?: string;
  staged: boolean;
  unstaged: boolean;
  added: boolean;
  deleted: boolean;
}

export interface RepoStatus {
  branch: string;
  ahead: number;
  behind: number;
  files: FileStatus[];
  hasConflicts: boolean;
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
  type: 'add' | 'del' | 'ctx';
  content: string;
  oldNo?: number;
  newNo?: number;
}
```

---

## Styling

Add to `bough/frontend/src/globals.css`:

```css
.file-status-list {
  @apply w-60 bg-sidebar border-r border-slate-200 dark:border-slate-800;
}

.diff-hunk-header {
  @apply bg-hunk hover:bg-yellow-300 dark:hover:bg-yellow-900
    px-4 py-2 flex items-center gap-3 cursor-pointer transition-colors;
}

.diff-line {
  @apply flex items-stretch font-mono text-xs leading-5;
}

.diff-line-add {
  @apply bg-add dark:bg-green-950;
}

.diff-line-del {
  @apply bg-del dark:bg-red-950;
}

.diff-line-ctx {
  @apply bg-content;
}

.commit-box {
  @apply flex-shrink-0 bg-panel border-t border-slate-200
    dark:border-slate-800 p-4 space-y-3;
}
```

---

## Verification Checklist

- [ ] File list shows Unstaged and Staged sections correctly
- [ ] Clicking file updates diff view
- [ ] Stage/Unstage buttons appear on hover
- [ ] Hunk headers show correct @@ ranges
- [ ] Stage hunk button works and queries invalidate
- [ ] Discard hunk button works (with confirmation?)
- [ ] Unstage hunk button works
- [ ] Line-level stage/discard buttons appear on hover
- [ ] Commit button disabled when message empty or no staged files
- [ ] ⌘+Enter commits successfully
- [ ] Amend checkbox toggles commit mode
- [ ] Flash notifications show success/error
- [ ] Diff view scrolls independently
- [ ] Binary files show "cannot display" message
- [ ] File renames show old/new path

---

## Implementation Order

1. Build FileStatusList with two sections (Unstaged/Staged)
2. Implement Go GetStatus and file staging APIs
3. Create ChunkDiffPanel with HunkBlock rendering
4. Build diff line display with proper coloring
5. Implement hunk-level staging (StageHunk/UnstageHunk/DiscardHunk)
6. Add line-level staging UI (buttons on hover)
7. Create CommitBox with message input and Commit button
8. Wire up query invalidation on commit success
9. Add keyboard shortcut ⌘+Enter for commit
10. Test with real repository (stage, discard, commit)
11. Add Amend mode and test
12. Optimize diff rendering for large files
