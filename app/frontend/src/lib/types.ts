// Canonical TypeScript types mirroring Go backend structs (git/types.go).
// Wails serialises Go PascalCase fields to camelCase JSON automatically.

export interface GraphLine {
  fromCol: number
  toCol: number
  color: number
  isMerge: boolean
}

export interface Ref {
  name: string
  type: string  // "branch" | "remote" | "tag" | "head"
  isHead: boolean
}

export interface CommitNode {
  hash: string
  shortHash: string
  message: string      // first line only — for list display
  fullMessage: string  // complete commit message
  author: string
  email: string
  date: string  // ISO string from Go time.Time
  parents: string[]
  refs: Ref[]
  column: number
  color: number
  lines: GraphLine[]
}

export interface DiffLine {
  type: string  // "add" | "del" | "ctx"
  content: string
  oldNo: number
  newNo: number
}

export interface DiffHunk {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffFile {
  path: string
  oldPath: string
  hunks: DiffHunk[]
  binary: boolean
}

export interface FileStatus {
  path: string
  oldPath: string
  staged: string
  unstaged: string
  added: number
  deleted: number
}

export interface Branch {
  name: string
  remote: string
  isHead: boolean
  upstream: string
  ahead: number
  behind: number
}

export interface BranchList {
  local: Branch[]
  remotes: Branch[]
}

export interface Tag {
  name: string
  hash: string
  date: string
  message: string
}

export interface StashEntry {
  index: number
  message: string
  hash: string
  date: string
}

export interface WorktreeInfo {
  path: string
  branch: string
  head: string
  isMain: boolean
  isDirty: boolean
}

export interface MergeState {
  mergingBranch: string
  conflictCount: number
  mergeMessage: string
}

export interface CherryPickState {
  conflictCount: number
  pickedMessage: string
}

export interface RebaseAction {
  action: 'pick' | 'reword' | 'squash' | 'fixup' | 'drop'
  hash: string
  message: string
}

export interface RebaseState {
  inProgress: boolean
  headName: string   // branch being rebased
  onto: string       // friendly name of base commit
  step: number
  total: number
  conflictCount: number
}

export interface RepoStatus {
  branch: string
  ahead: number
  behind: number
  files: FileStatus[]
  hasConflicts: boolean
  mergeState?: MergeState
  cherryPickState?: CherryPickState
  rebaseState?: RebaseState
}

export interface Remote {
  name: string
  fetchURL: string
  pushURL: string
}
