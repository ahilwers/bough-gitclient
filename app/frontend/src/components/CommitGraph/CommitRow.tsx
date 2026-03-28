import type { CommitNode } from '@/lib/types'
import { formatRelativeDate } from '@/lib/format'
import { graphColor } from '@/lib/colors'

const ROW_HEIGHT = 34

interface CommitRowProps {
  commit: CommitNode
  isSelected: boolean
  graphWidth: number
  authorWidth: number
  dateWidth: number
  style?: React.CSSProperties
  onClick: (hash: string) => void
}

export function CommitRow({ commit, isSelected, graphWidth, authorWidth, dateWidth, style, onClick }: CommitRowProps) {
  const timeAgo = formatRelativeDate(commit.date)

  return (
    <div
      style={{
        height: ROW_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        background: 'transparent',
        cursor: 'pointer',
        userSelect: 'none',
        ...style,
      }}
      onClick={() => onClick(commit.hash)}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
    >
      {/* Graph spacer — canvas draws behind this */}
      <div style={{ width: graphWidth, flexShrink: 0 }} />

      {/* Summary: refs + short hash + message */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', paddingRight: 8 }}>
        {commit.refs && commit.refs.length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            {commit.refs.map((ref, idx) => (
              <RefChip key={idx} name={ref.name} colorIndex={commit.color} isHead={ref.isHead} />
            ))}
          </div>
        )}
        <code style={{
          fontFamily: 'monospace',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-ter)',
          flexShrink: 0,
          width: 52,
        }}>
          {commit.shortHash}
        </code>
        <span style={{
          fontSize: 13,
          color: 'var(--text-pri)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          flex: 1,
          minWidth: 0,
        }}>
          {commit.message}
        </span>
      </div>

      {/* Author */}
      <div style={{
        width: authorWidth,
        flexShrink: 0,
        fontSize: 12,
        color: 'var(--text-ter)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        paddingLeft: 8,
        paddingRight: 8,
      }}>
        {commit.author}
      </div>

      {/* Date */}
      <div style={{
        width: dateWidth,
        flexShrink: 0,
        fontSize: 12,
        color: 'var(--text-ter)',
        whiteSpace: 'nowrap',
        paddingLeft: 8,
        paddingRight: 8,
        textAlign: 'right',
      }}>
        {timeAgo}
      </div>
    </div>
  )
}

interface RefChipProps {
  name: string
  colorIndex: number
  isHead: boolean
}

function RefChip({ name, colorIndex, isHead }: RefChipProps) {
  const bg = graphColor(colorIndex)
  const label = name
    .replace(/^refs\/(heads|remotes)\//, '')
    .replace(/^HEAD -> /, '')

  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: 10,
        fontFamily: 'monospace',
        fontWeight: 600,
        color: 'white',
        backgroundColor: bg,
        opacity: isHead ? 1 : 0.85,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        maxWidth: 110,
        flexShrink: 0,
      }}
      title={label}
    >
      {label}
    </span>
  )
}
