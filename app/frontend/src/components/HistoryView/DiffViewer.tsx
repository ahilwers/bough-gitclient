import { DiffEditor } from '@monaco-editor/react'
import { useGitStore } from '@/stores/gitStore'
import { useFileAtCommit } from '@/hooks/useFileAtCommit'

const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', go: 'go', rs: 'rust',
  c: 'c', cpp: 'cpp', h: 'c', java: 'java',
  json: 'json', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', html: 'html', css: 'css',
  scss: 'scss', sh: 'shell', sql: 'sql',
  rb: 'ruby', swift: 'swift', kt: 'kotlin',
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_MAP[ext] ?? 'plaintext'
}

interface DiffViewerProps {
  commitHash: string
  filePath: string
}

export function DiffViewer({ commitHash, filePath }: DiffViewerProps) {
  const { theme } = useGitStore()
  const { current, parent } = useFileAtCommit(commitHash, filePath)
  const language = detectLanguage(filePath)

  const isLoading = current.isLoading || parent.isLoading

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 12, color: 'var(--text-ter)' }}>
        Loading diff…
      </div>
    )
  }

  return (
    <DiffEditor
      height="100%"
      original={parent.data ?? ''}
      modified={current.data ?? ''}
      language={language}
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}
      options={{
        readOnly: true,
        renderSideBySide: false,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        fontSize: 12,
        lineNumbers: 'on',
        renderOverviewRuler: false,
      }}
    />
  )
}
