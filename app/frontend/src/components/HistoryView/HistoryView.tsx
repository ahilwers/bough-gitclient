import { CommitList } from '@/components/CommitGraph/CommitList'

export default function HistoryView() {
  return (
    <div style={{ flex: 1, display: 'flex', background: 'var(--bg-content)', overflow: 'hidden' }}>
      <CommitList />
    </div>
  )
}
