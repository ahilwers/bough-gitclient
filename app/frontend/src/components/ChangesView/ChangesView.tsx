import { useState } from 'react'
import { FileStatusList } from './FileStatusList'
import { ChunkDiffPanel } from './ChunkDiffPanel'
import { CommitBox } from './CommitBox'
import type { FileStatus } from '@/lib/types'

export default function ChangesView() {
  const [selectedFile, setSelectedFile] = useState<FileStatus | null>(null)
  const [selectedStaged, setSelectedStaged] = useState(false)

  function handleSelectFile(file: FileStatus, staged: boolean) {
    setSelectedFile(file)
    setSelectedStaged(staged)
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: 'var(--bg-content)' }}>
      {/* File status list (240px, left) */}
      <FileStatusList
        selectedFile={selectedFile?.path ?? null}
        selectedStaged={selectedStaged}
        onSelectFile={handleSelectFile}
      />

      {/* Diff panel + commit box (flex:1, right) */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {selectedFile ? (
          <>
            <ChunkDiffPanel filePath={selectedFile.path} staged={selectedStaged} fileStatus={selectedFile} />
            <CommitBox />
          </>
        ) : (
          <>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-ter)', fontSize: 12,
            }}>
              Select a file to view changes
            </div>
            <CommitBox />
          </>
        )}
      </div>
    </div>
  )
}
