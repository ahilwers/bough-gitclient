import { ImageDiffView } from '@/components/shared/ImageDiffView'
import { useWorkingImageDiff } from '@/hooks/useImageDiff'

interface WorkingImageDiffProps {
  filePath: string
  staged: boolean
  isUntracked: boolean
}

/**
 * Side-by-side image diff for uncommitted changes:
 * untracked → worktree only · staged → HEAD vs index · unstaged → index vs worktree.
 */
export function WorkingImageDiff({ filePath, staged, isUntracked }: WorkingImageDiffProps) {
  const { left, right, isLoading } = useWorkingImageDiff(filePath, staged, isUntracked)

  const leftLabel = staged ? 'HEAD' : 'Index'
  const rightLabel = staged ? 'Index' : 'Worktree'

  return (
    <div style={{ flex: 1, minHeight: 0, padding: 8, boxSizing: 'border-box', background: 'var(--bg-content)' }}>
      <ImageDiffView
        left={left}
        right={right}
        leftLabel={leftLabel}
        rightLabel={rightLabel}
        leftEmptyHint="No image in previous version"
        rightEmptyHint="No image in current version"
        loading={isLoading}
      />
    </div>
  )
}
