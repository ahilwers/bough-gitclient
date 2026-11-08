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

import { vi } from 'vitest'

import type {
  BranchDeletionInfo,
  PullResult,
  PullSnapshot,
  RebaseAction,
  Remote,
  StashEntry,
  Tag,
} from '../../../../../bindings/bough/git'

// Types mirroring bindings/bough/git/models.ts
export interface GraphLine { fromCol: number; toCol: number; color: number; isMerge: boolean }
export interface Ref { name: string; type: string; isHead: boolean }
export interface CommitNode {
  hash: string; shortHash: string; message: string; fullMessage: string; author: string; email: string
  date: Date; parents: string[]; refs: Ref[]; column: number; color: number; lines: GraphLine[]
}
export interface DiffLine { type: string; content: string; oldNo: number; newNo: number }
export interface DiffHunk { header: string; oldStart: number; oldLines: number; newStart: number; newLines: number; lines: DiffLine[] }
export interface DiffFile { path: string; oldPath: string; hunks: DiffHunk[]; binary: boolean }
export interface ImageSource { dataURL: string; size: number }
export interface FileStatus { path: string; oldPath: string; staged: string; unstaged: string; added: number; deleted: number }
export interface RepoStatus { branch: string; ahead: number; behind: number; files: FileStatus[]; hasConflicts: boolean }

// Default mock implementations — override per test with vi.mocked(Fn).mockResolvedValue(...)
export const OpenRepository = vi.fn((_path: string): Promise<string> => Promise.resolve('/tmp/test-repo'))
export const GetCommits = vi.fn((_limit: number, _all: boolean): Promise<CommitNode[]> => Promise.resolve([]))
export const GetCommitDiff = vi.fn((_hash: string): Promise<DiffFile[]> => Promise.resolve([]))
export const GetFileAtCommit = vi.fn((_hash: string, _path: string): Promise<string> => Promise.resolve(''))
export const GetFileAtCommitParent = vi.fn((_hash: string, _path: string): Promise<string> => Promise.resolve(''))
export const GetStatus = vi.fn((): Promise<RepoStatus> =>
  Promise.resolve({ branch: 'main', ahead: 0, behind: 0, files: [], hasConflicts: false }))
export const GetFileDiff = vi.fn((_path: string, _staged: boolean): Promise<DiffFile> =>
  Promise.resolve({ path: '', oldPath: '', hunks: [], binary: false }))
export const GetUntrackedFileDiff = vi.fn((_path: string): Promise<DiffFile> =>
  Promise.resolve({ path: '', oldPath: '', hunks: [], binary: false }))
export const GetImageAtCommit = vi.fn((_hash: string, _path: string): Promise<ImageSource> => Promise.resolve({ dataURL: '', size: 0 }))
export const GetImageAtCommitParent = vi.fn((_hash: string, _path: string): Promise<ImageSource> => Promise.resolve({ dataURL: '', size: 0 }))
export const GetImageFromWorktree = vi.fn((_path: string): Promise<ImageSource> => Promise.resolve({ dataURL: '', size: 0 }))
export const GetImageFromIndex = vi.fn((_path: string): Promise<ImageSource> => Promise.resolve({ dataURL: '', size: 0 }))
export const GetImageFromHead = vi.fn((_path: string): Promise<ImageSource> => Promise.resolve({ dataURL: '', size: 0 }))
export const GetImageFromMergeStage = vi.fn((_path: string, _stage: number): Promise<ImageSource> => Promise.resolve({ dataURL: '', size: 0 }))
export const GetImageFromStash = vi.fn((_index: number, _path: string): Promise<ImageSource> => Promise.resolve({ dataURL: '', size: 0 }))
export const GetImageFromStashBase = vi.fn((_index: number, _path: string): Promise<ImageSource> => Promise.resolve({ dataURL: '', size: 0 }))
export const StageFile = vi.fn((_path: string): Promise<void> => Promise.resolve())
export const StageFiles = vi.fn((_paths: string[]): Promise<void> => Promise.resolve())
export const UnstageFile = vi.fn((_path: string): Promise<void> => Promise.resolve())
export const UnstageFiles = vi.fn((_paths: string[]): Promise<void> => Promise.resolve())
export const StageHunk = vi.fn((_patch: string): Promise<void> => Promise.resolve())
export const UnstageHunk = vi.fn((_patch: string): Promise<void> => Promise.resolve())
export const DiscardHunk = vi.fn((_patch: string): Promise<void> => Promise.resolve())
export const CreateCommit = vi.fn((_message: string): Promise<string> =>
  Promise.resolve('abc1234567890abcdef1234567890abcdef1234ab'))
export const AmendCommit = vi.fn((_message: string): Promise<void> => Promise.resolve())
export const Fetch = vi.fn((_remote: string): Promise<void> => Promise.resolve())
export const Pull = vi.fn((_remote: string, _branch: string): Promise<void> => Promise.resolve())
export const Push = vi.fn((_remote: string, _branch: string, _force: boolean): Promise<void> => Promise.resolve())
export const GetPushInfo = vi.fn(() => Promise.resolve({ repoPath: '/repo', branch: 'main', upstream: 'origin/main', remotes: ['origin'] }))
export const PushWithUpstream = vi.fn((_repoPath: string, _remote: string, _branch: string): Promise<void> => Promise.resolve())
export const StoreCredentials = vi.fn((_url: string, _user: string, _pass: string): Promise<void> => Promise.resolve())

// Branches & worktrees
export interface BranchInfo { name: string; remote: string; isHead: boolean; upstream: string; ahead: number; behind: number }
export interface BranchList { local: BranchInfo[]; remotes: BranchInfo[] }
export interface WorktreeInfo { path: string; branch: string; head: string; isMain: boolean; isDirty: boolean }
export const ListBranches = vi.fn((): Promise<BranchList> => Promise.resolve({ local: [], remotes: [] }))
export const CreateBranch = vi.fn((_name: string, _from: string, _checkoutAfter: boolean): Promise<void> => Promise.resolve())
export const PrepareBranchDeletion = vi.fn((_name: string, _remote: string): Promise<BranchDeletionInfo> =>
  Promise.resolve({ repoPath: '/repo', name: _name, remote: _remote, ref: '', oid: '', destination: '', configFingerprint: '' }))
export const DeleteBranch = vi.fn((_info: BranchDeletionInfo): Promise<void> => Promise.resolve())
export const CreateStash = vi.fn((_message: string, _includeUntracked: boolean): Promise<void> => Promise.resolve())
export const CreateTag = vi.fn((_name: string, _target: string): Promise<void> => Promise.resolve())
export const ListWorktrees = vi.fn((): Promise<WorktreeInfo[]> => Promise.resolve([]))
export const AddWorktree = vi.fn((_path: string, _branch: string): Promise<void> => Promise.resolve())
export const RemoveWorktree = vi.fn((_path: string): Promise<void> => Promise.resolve())
export const SwitchWorktree = vi.fn((_path: string): Promise<void> => Promise.resolve())
export const OpenInFinder = vi.fn((_path: string): Promise<void> => Promise.resolve())
export const SelectRepository = vi.fn((): Promise<string> => Promise.resolve(''))
export const SaveWindowSize = vi.fn((_width: number, _height: number): Promise<void> => Promise.resolve())
export const GetAISettings = vi.fn(() => Promise.resolve({ provider: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', hasAPIKey: false }))
export const SaveAISettings = vi.fn(() => Promise.resolve())
export const GenerateCommitMessage = vi.fn(() => Promise.resolve('Suggested subject\n\nSuggested body.'))
export const GetRecentRepos = vi.fn((): Promise<string[]> => Promise.resolve([]))
export const GetAppVersion = vi.fn((): Promise<string> => Promise.resolve('0.1.0'))
export const DiscardFile = vi.fn((_path: string): Promise<void> => Promise.resolve())

export const PullForUI = vi.fn((_repo: string, _branch: string): Promise<PullResult> => Promise.resolve({ outcome: 'success' }))
export const ResolvePull = vi.fn((_snapshot: PullSnapshot, _strategy: string): Promise<PullResult> => Promise.resolve({ outcome: 'success' }))

// Remaining bound methods (kept in sync with bindings/bough/app.ts so tests
// that exercise an un-mocked import path never resolve undefined).
export const AbortCherryPick = vi.fn((): Promise<void> => Promise.resolve())
export const AbortMerge = vi.fn((): Promise<void> => Promise.resolve())
export const AbortRebase = vi.fn((): Promise<void> => Promise.resolve())
export const AcceptBoth = vi.fn((_filePath: string): Promise<void> => Promise.resolve())
export const AddRemote = vi.fn((_name: string, _url: string): Promise<void> => Promise.resolve())
export const ApplyStash = vi.fn((_index: number): Promise<void> => Promise.resolve())
export const ApplyStashFile = vi.fn((_index: number, _filePath: string): Promise<void> => Promise.resolve())
export const ApplyStashHunk = vi.fn((_patch: string): Promise<void> => Promise.resolve())
export const CheckoutBranch = vi.fn((_branch: string): Promise<void> => Promise.resolve())
export const CheckoutOurs = vi.fn((_filePath: string): Promise<void> => Promise.resolve())
export const CheckoutRemoteBranch = vi.fn((_remoteBranch: string): Promise<void> => Promise.resolve())
export const CheckoutTag = vi.fn((_tag: string): Promise<void> => Promise.resolve())
export const CheckoutTheirs = vi.fn((_filePath: string): Promise<void> => Promise.resolve())
export const CherryPickCommits = vi.fn((_hashes: string[] | null): Promise<void> => Promise.resolve())
export const CommitsOnRemote = vi.fn((_hashes: string[] | null): Promise<string[] | null> => Promise.resolve(null))
export const ContinueRebase = vi.fn((): Promise<void> => Promise.resolve())
export const DeleteTag = vi.fn((_tag: string): Promise<void> => Promise.resolve())
export const DiscardStagedFile = vi.fn((_filePath: string): Promise<void> => Promise.resolve())
export const DropStash = vi.fn((_index: number): Promise<void> => Promise.resolve())
export const GetFileContent = vi.fn((_filePath: string): Promise<string> => Promise.resolve(''))
export const GetMergeCommits = vi.fn((): Promise<CommitNode[]> => Promise.resolve([]))
export const GetStashDiff = vi.fn((_index: number): Promise<DiffFile[]> => Promise.resolve([]))
export const ListRemotes = vi.fn((): Promise<Remote[]> => Promise.resolve([]))
export const ListStashes = vi.fn((): Promise<StashEntry[]> => Promise.resolve([]))
export const ListTags = vi.fn((): Promise<Tag[]> => Promise.resolve([]))
export const MergeBranch = vi.fn((_from: string): Promise<void> => Promise.resolve())
export const OpenMergeToolForFile = vi.fn((_filePath: string): Promise<void> => Promise.resolve())
export const PopStash = vi.fn((_index: number): Promise<void> => Promise.resolve())
export const PullIntoLocalBranch = vi.fn((_remote: string, _localBranch: string): Promise<void> => Promise.resolve())
export const RemoveRemote = vi.fn((_name: string): Promise<void> => Promise.resolve())
export const RenameRemote = vi.fn((_oldName: string, _newName: string): Promise<void> => Promise.resolve())
export const RevealInFinder = vi.fn((_relativePath: string): Promise<void> => Promise.resolve())
export const SelectAndInitRepository = vi.fn((): Promise<string> => Promise.resolve(''))
export const StartInteractiveRebase = vi.fn((_actions: RebaseAction[] | null): Promise<void> => Promise.resolve())
export const UpdateRemote = vi.fn((_name: string, _url: string): Promise<void> => Promise.resolve())
