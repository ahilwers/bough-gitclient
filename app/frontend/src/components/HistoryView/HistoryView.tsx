import { useState } from 'react'
import { Search } from 'lucide-react'
import { useGitStore } from '@/stores/gitStore'
import { CommitList } from '@/components/CommitGraph/CommitList'
import { CommitDetailPanel } from './CommitDetailPanel'

export default function HistoryView() {
  const { selectedCommit } = useGitStore()
  const [showAllBranches, setShowAllBranches] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-content)' }}>
      {/* Search / filter bar */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', borderBottom: '1px solid var(--border-sub)',
        background: 'var(--bg-toolbar)', flexShrink: 0,
      }}>
        <Search size={13} style={{ color: 'var(--text-ter)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search commits…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent', fontSize: 13, color: 'var(--text-pri)',
          }}
        />
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: 'var(--text-sec)', whiteSpace: 'nowrap', cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={showAllBranches}
            onChange={e => setShowAllBranches(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          All Branches
        </label>
      </div>

      {/* Commit list + detail panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <CommitList all={showAllBranches} searchQuery={searchQuery} />
        {selectedCommit && <CommitDetailPanel commitHash={selectedCommit} />}
      </div>
    </div>
  )
}
