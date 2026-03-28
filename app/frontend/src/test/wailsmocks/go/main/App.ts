import { vi } from 'vitest'

// Types mirroring wailsjs/go/models.ts
export interface GraphLine { fromCol: number; toCol: number; color: number; isMerge: boolean }
export interface Ref { name: string; type: string; isHead: boolean }
export interface CommitNode {
  hash: string; shortHash: string; message: string; author: string; email: string
  date: Date; parents: string[]; refs: Ref[]; column: number; color: number; lines: GraphLine[]
}
export interface DiffLine { type: string; content: string; oldNo: number; newNo: number }
export interface DiffHunk { header: string; oldStart: number; oldLines: number; newStart: number; newLines: number; lines: DiffLine[] }
export interface DiffFile { path: string; oldPath: string; hunks: DiffHunk[]; binary: boolean }
export interface FileStatus { path: string; oldPath: string; staged: string; unstaged: string; added: number; deleted: number }
export interface RepoStatus { branch: string; ahead: number; behind: number; files: FileStatus[]; hasConflicts: boolean }

// Default mock implementations — override per test with vi.mocked(Fn).mockResolvedValue(...)
export const OpenRepository = vi.fn((_path: string): Promise<string> => Promise.resolve('/tmp/test-repo'))
export const GetCommits = vi.fn((_limit: number): Promise<CommitNode[]> => Promise.resolve([]))
export const GetCommitDiff = vi.fn((_hash: string): Promise<DiffFile[]> => Promise.resolve([]))
export const GetStatus = vi.fn((): Promise<RepoStatus> =>
  Promise.resolve({ branch: 'main', ahead: 0, behind: 0, files: [], hasConflicts: false }))
export const GetFileDiff = vi.fn((_path: string, _staged: boolean): Promise<DiffFile> =>
  Promise.resolve({ path: '', oldPath: '', hunks: [], binary: false }))
export const StageFile = vi.fn((_path: string): Promise<void> => Promise.resolve())
export const UnstageFile = vi.fn((_path: string): Promise<void> => Promise.resolve())
export const StageHunk = vi.fn((_patch: string): Promise<void> => Promise.resolve())
export const DiscardHunk = vi.fn((_patch: string): Promise<void> => Promise.resolve())
export const CreateCommit = vi.fn((_message: string): Promise<string> =>
  Promise.resolve('abc1234567890abcdef1234567890abcdef1234ab'))
export const AmendCommit = vi.fn((_message: string): Promise<void> => Promise.resolve())
export const Fetch = vi.fn((_remote: string): Promise<void> => Promise.resolve())
export const Pull = vi.fn((_remote: string, _branch: string): Promise<void> => Promise.resolve())
export const Push = vi.fn((_remote: string, _branch: string, _force: boolean): Promise<void> => Promise.resolve())
export const StoreCredentials = vi.fn((_url: string, _user: string, _pass: string): Promise<void> => Promise.resolve())

// Branches & worktrees
export interface BranchInfo { name: string; remote: string; isHead: boolean; upstream: string; ahead: number; behind: number }
export interface BranchList { local: BranchInfo[]; remotes: BranchInfo[] }
export interface WorktreeInfo { path: string; branch: string; head: string; isMain: boolean; isDirty: boolean }
export const ListBranches = vi.fn((): Promise<BranchList> => Promise.resolve({ local: [], remotes: [] }))
export const ListWorktrees = vi.fn((): Promise<WorktreeInfo[]> => Promise.resolve([]))
export const AddWorktree = vi.fn((_path: string, _branch: string): Promise<void> => Promise.resolve())
export const SelectRepository = vi.fn((): Promise<string> => Promise.resolve(''))
