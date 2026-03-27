# Implementation Plan: Commit Graph Renderer

## Overview
The commit graph is a 2D Canvas element that renders Git commit history as a DAG with commit dots, branch lines, and inline branch label chips. It integrates with a virtualized DOM list for efficient rendering of large histories.

## Component Architecture

### GraphCanvas Component
**File:** `bough/frontend/src/components/GraphCanvas.tsx`

This is a React wrapper around an HTML5 Canvas that renders the commit graph. It uses `useRef`, `useEffect`, and scroll synchronization with the DOM commit list.

```typescript
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GetCommits } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime';
import { CommitNode, GraphLine } from '../types';

const ROW_HEIGHT = 34;
const COL_WIDTH = 14;
const OFFSET_X = 12;
const DOT_RADIUS = 4;
const MERGE_DOT_RADIUS = 5;

const COLORS = [
  '#0066CC', '#00875A', '#D92D20', '#7C3AED',
  '#C4680A', '#0891B2', '#BE185D', '#15803D'
];

interface GraphCanvasProps {
  onSelectCommit: (hash: string) => void;
  selectedHash?: string;
  showAllBranches: boolean;
  scrollTop: number;
  containerHeight: number;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  onSelectCommit,
  selectedHash,
  showAllBranches,
  scrollTop,
  containerHeight
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [devicePixelRatio, setDevicePixelRatio] = useState(window.devicePixelRatio || 1);

  const { data: commits = [] } = useQuery({
    queryKey: ['commits', showAllBranches],
    queryFn: async () => {
      const result = await GetCommits(500);
      return result || [];
    },
    staleTime: Infinity,
  });

  // Listen for repo changes to invalidate query
  useEffect(() => {
    const unsubscribe = EventsOn('repo:changed', () => {
      // Query invalidation handled by Zustand store
    });
    return unsubscribe;
  }, []);

  // Calculate graph dimensions
  const maxColumn = Math.max(...commits.map((c: CommitNode) => c.column), 0) + 1;
  const canvasWidth = Math.max(200, OFFSET_X + maxColumn * COL_WIDTH + 20);
  const canvasHeight = commits.length * ROW_HEIGHT;

  // Redraw canvas when commits change or scroll position changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution for retina displays
    canvas.width = canvasWidth * devicePixelRatio;
    canvas.height = canvasHeight * devicePixelRatio;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw graph lines first (behind dots)
    drawGraphLines(ctx, commits, scrollTop, containerHeight);

    // Draw commit dots
    drawCommitDots(ctx, commits, selectedHash, scrollTop, containerHeight);

  }, [commits, scrollTop, containerHeight, selectedHash, canvasWidth, canvasHeight, devicePixelRatio]);

  return (
    <div className="relative flex-1 bg-content overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0"
        style={{
          transform: `translateY(-${scrollTop}px)`,
          transition: 'transform 0.016s linear',
        }}
      />
    </div>
  );
};

function drawGraphLines(
  ctx: CanvasRenderingContext2D,
  commits: CommitNode[],
  scrollTop: number,
  containerHeight: number
) {
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 1.5;

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
  const endIdx = Math.min(commits.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 5);

  for (let i = startIdx; i < endIdx; i++) {
    const commit = commits[i];
    if (!commit.lines || commit.lines.length === 0) continue;

    for (const line of commit.lines) {
      const fromX = OFFSET_X + line.fromCol * COL_WIDTH;
      const toX = OFFSET_X + line.toCol * COL_WIDTH;
      const y = i * ROW_HEIGHT + ROW_HEIGHT / 2;

      ctx.strokeStyle = COLORS[line.color % COLORS.length];
      ctx.beginPath();

      if (line.isMerge) {
        // Bézier curve for merge lines
        const controlX = (fromX + toX) / 2;
        const controlY = y + ROW_HEIGHT / 2;
        ctx.moveTo(fromX, y);
        ctx.quadraticCurveTo(controlX, controlY, toX, y + ROW_HEIGHT);
      } else {
        // Straight line
        ctx.moveTo(fromX, y);
        ctx.lineTo(toX, y + ROW_HEIGHT);
      }
      ctx.stroke();
    }
  }
}

function drawCommitDots(
  ctx: CanvasRenderingContext2D,
  commits: CommitNode[],
  selectedHash?: string,
  scrollTop?: number,
  containerHeight?: number
) {
  const startIdx = Math.max(0, Math.floor((scrollTop ?? 0) / ROW_HEIGHT) - 5);
  const endIdx = Math.min(
    commits.length,
    Math.ceil(((scrollTop ?? 0) + (containerHeight ?? 0)) / ROW_HEIGHT) + 5
  );

  for (let i = startIdx; i < endIdx; i++) {
    const commit = commits[i];
    const x = OFFSET_X + commit.column * COL_WIDTH;
    const y = i * ROW_HEIGHT + ROW_HEIGHT / 2;
    const isSelected = commit.hash === selectedHash;

    // Outer circle (selection highlight or hollow)
    ctx.strokeStyle = isSelected ? COLORS[commit.color] : '#D1D5DB';
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(x, y, DOT_RADIUS + 1, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dot
    ctx.fillStyle = COLORS[commit.color];
    ctx.beginPath();
    ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Merge indicator (small ring)
    if (commit.parents && commit.parents.length > 1) {
      ctx.strokeStyle = COLORS[commit.color];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, MERGE_DOT_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
```

---

## CommitRow Component (DOM Layer)

**File:** `bough/frontend/src/components/CommitRow.tsx`

This component renders the actual commit information (hash, message, author, timestamp) in the DOM, positioned above the canvas.

```typescript
import React from 'react';
import { CommitNode } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface CommitRowProps {
  commit: CommitNode;
  isSelected: boolean;
  onClick: (hash: string) => void;
}

export const CommitRow: React.FC<CommitRowProps> = ({
  commit,
  isSelected,
  onClick
}) => {
  const timeAgo = formatDistanceToNow(new Date(commit.date), { addSuffix: true });

  return (
    <div
      className={`
        h-[34px] flex items-center px-3 gap-3 cursor-pointer
        hover:bg-slate-100 dark:hover:bg-slate-900
        ${isSelected ? 'bg-blue-50 dark:bg-blue-950' : ''}
      `}
      onClick={() => onClick(commit.hash)}
      role="button"
      tabIndex={0}
    >
      {/* Branch labels */}
      <div className="flex gap-1">
        {commit.refs && commit.refs.map((ref, idx) => (
          <BranchChip key={idx} ref={ref} color={commit.color} />
        ))}
      </div>

      {/* Hash (monospace, 7 chars) */}
      <code className="font-mono text-xs font-bold text-text-ter">
        {commit.shortHash}
      </code>

      {/* Message (truncate overflow) */}
      <span className="text-sm text-text-pri truncate flex-1">
        {commit.message}
      </span>

      {/* Author & timestamp */}
      <span className="text-xs text-text-ter whitespace-nowrap">
        {commit.author}
      </span>
      <span className="text-xs text-text-ter whitespace-nowrap">
        {timeAgo}
      </span>
    </div>
  );
};

interface BranchChipProps {
  ref: string;
  color: number;
}

const COLORS = [
  '#0066CC', '#00875A', '#D92D20', '#7C3AED',
  '#C4680A', '#0891B2', '#BE185D', '#15803D'
];

const BranchChip: React.FC<BranchChipProps> = ({ ref, color }) => {
  const bgColor = COLORS[color % COLORS.length];
  const label = ref.replace(/^refs\/(heads|remotes)\//, '');

  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-mono font-semibold text-white truncate max-w-[120px]"
      style={{ backgroundColor: bgColor }}
      title={label}
    >
      {label}
    </span>
  );
};
```

---

## CommitList (Virtualized Container)

**File:** `bough/frontend/src/components/CommitList.tsx`

This component manages the virtualized list and scroll synchronization with the canvas.

```typescript
import React, { useRef, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GetCommits } from '../wailsjs/go/main/App';
import { CommitNode } from '../types';
import { CommitRow } from './CommitRow';
import { GraphCanvas } from './GraphCanvas';

const ROW_HEIGHT = 34;

interface CommitListProps {
  onSelectCommit: (hash: string) => void;
  selectedHash?: string;
  showAllBranches: boolean;
}

export const CommitList: React.FC<CommitListProps> = ({
  onSelectCommit,
  selectedHash,
  showAllBranches
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  const { data: commits = [] } = useQuery({
    queryKey: ['commits', showAllBranches],
    queryFn: async () => {
      const result = await GetCommits(500);
      return result || [];
    },
    staleTime: 30000,
  });

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIndex = commits.findIndex(c => c.hash === selectedHash);
    if (currentIndex === -1) return;

    let newIndex = currentIndex;
    if (e.key === 'j' || e.key === 'ArrowDown') {
      newIndex = Math.min(currentIndex + 1, commits.length - 1);
      e.preventDefault();
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      newIndex = Math.max(currentIndex - 1, 0);
      e.preventDefault();
    }

    if (newIndex !== currentIndex) {
      const commit = commits[newIndex];
      onSelectCommit(commit.hash);

      // Scroll into view
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        const targetScrollTop = newIndex * ROW_HEIGHT;
        scrollContainer.scrollTop = targetScrollTop;
      }
    }
  }, [commits, selectedHash, onSelectCommit]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Canvas (background) */}
      <GraphCanvas
        onSelectCommit={onSelectCommit}
        selectedHash={selectedHash}
        showAllBranches={showAllBranches}
        scrollTop={scrollTop}
        containerHeight={containerHeight}
      />

      {/* Scroll container with DOM rows */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div
          style={{
            height: commits.length * ROW_HEIGHT,
            position: 'relative',
          }}
        >
          {/* Virtual rendering: only render visible rows ±buffer */}
          {renderVisibleRows(commits, scrollTop, containerHeight)}
        </div>
      </div>
    </div>
  );
};

function renderVisibleRows(
  commits: CommitNode[],
  scrollTop: number,
  containerHeight: number
) {
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
  const endIdx = Math.min(
    commits.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 5
  );

  return commits.slice(startIdx, endIdx).map((commit, idx) => {
    const absoluteIdx = startIdx + idx;
    const offsetTop = absoluteIdx * ROW_HEIGHT;

    return (
      <div
        key={commit.hash}
        className="absolute left-0 right-0"
        style={{ top: offsetTop, height: ROW_HEIGHT }}
      >
        <CommitRow
          commit={commit}
          isSelected={false}
          onClick={(hash) => {
            // Handle selection
          }}
        />
      </div>
    );
  });
}
```

---

## TanStack Query Integration

**File:** `bough/frontend/src/hooks/useCommits.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GetCommits } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime';
import { CommitNode } from '../types';
import { useEffect } from 'react';

export const useCommits = (limit: number = 500, showAllBranches: boolean = false) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['commits', showAllBranches, limit],
    queryFn: async () => {
      const result = await GetCommits(limit);
      return (result || []) as CommitNode[];
    },
    staleTime: 30000,
  });

  // Listen for repo changes and invalidate
  useEffect(() => {
    const unsubscribe = EventsOn('repo:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['commits'] });
    });
    return unsubscribe;
  }, [queryClient]);

  return query;
};
```

---

## Go Backend Types

**File:** `bough/git/types.go` (excerpt for CommitNode and GraphLine)

```go
package git

import "time"

type CommitNode struct {
	Hash      string       `json:"hash"`
	ShortHash string       `json:"shortHash"`
	Message   string       `json:"message"`
	Author    string       `json:"author"`
	Email     string       `json:"email"`
	Date      time.Time    `json:"date"`
	Parents   []string     `json:"parents"`
	Refs      []string     `json:"refs"`
	Column    int          `json:"column"`
	Color     int          `json:"color"`
	Lines     []GraphLine  `json:"lines"`
}

type GraphLine struct {
	FromCol int    `json:"fromCol"`
	ToCol   int    `json:"toCol"`
	Color   int    `json:"color"`
	IsMerge bool   `json:"isMerge"`
}
```

---

## Keyboard Navigation

Add to your global keyboard hook:

```typescript
export const useKeyboard = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // j/k handled by CommitList itself
      // ⌘K opens command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Emit event to open palette
        window.dispatchEvent(new CustomEvent('palette:open'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
```

---

## Verification Checklist

- [ ] Canvas renders commit dots at correct positions
- [ ] Branch lines draw correctly for linear and merge commits
- [ ] Scroll position syncs between canvas and DOM rows
- [ ] Selected commit highlighted in both canvas and DOM
- [ ] Virtualization renders only visible rows (test with 10k+ commits)
- [ ] Keyboard j/k navigation works bidirectionally
- [ ] Color assignment is deterministic per commit
- [ ] Retina display support (devicePixelRatio scaling)
- [ ] Branch chips display inline without wrapping
- [ ] Query invalidates on 'repo:changed' event
- [ ] Performance: 500 commits render in <100ms

---

## Color Palette Reference

```
--acc: #0066CC (light) / #0A84FF (dark)
Success: #00875A
Danger: #D92D20
Warning: #C4680A
Branch colors 0-7: rotation of the COLORS array above
```

---

## Implementation Order

1. Implement CommitNode type system in Go (git/types.go)
2. Implement GetCommits Go function that returns CommitNode array
3. Build CommitRow DOM component
4. Build GraphCanvas with drawing functions
5. Wrap in CommitList with scroll sync
6. Add keyboard navigation (j/k)
7. Integrate TanStack Query and EventsOn listeners
8. Test with real repository (100+ commits)
9. Optimize virtualization if needed
10. Add selection highlighting
