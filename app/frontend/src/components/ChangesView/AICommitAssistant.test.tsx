import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AICommitAssistant } from './AICommitAssistant'
import { GenerateCommitMessage, GetAISettings, SaveAISettings } from '@wailsjs/go/main/App'

vi.mock('@wailsjs/go/main/App', () => ({ GenerateCommitMessage: vi.fn(), GetAISettings: vi.fn(), SaveAISettings: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(GetAISettings).mockResolvedValue({ provider: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', model: 'test', hasAPIKey: true })
})
it('previews without modifying input until explicit apply', async () => {
  vi.mocked(GenerateCommitMessage).mockResolvedValue('Add feature\n\nExplain why.')
  const apply = vi.fn()
  render(<AICommitAssistant hasStaged onApply={apply} />)
  await waitFor(() => expect(screen.getByText('Generate with AI')).not.toBeDisabled())
  fireEvent.click(screen.getByText('Generate with AI'))
  await screen.findByText('Suggested message — review before applying')
  expect(apply).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Replace input with suggestion'))
  expect(apply).toHaveBeenCalledWith('Add feature\n\nExplain why.')
})
it('requires staged changes and never generates automatically', async () => {
  render(<AICommitAssistant hasStaged={false} onApply={vi.fn()} />)
  await screen.findByText('AI settings')
  expect(screen.getByText('Generate with AI')).toBeDisabled()
  expect(GenerateCommitMessage).not.toHaveBeenCalled()
  expect(screen.getByText(/up to 512 KiB/)).toHaveTextContent(/model's context limit/)
})
it('saves keys through backend without displaying stored secrets', async () => {
  vi.mocked(SaveAISettings).mockResolvedValue(undefined)
  render(<AICommitAssistant hasStaged onApply={vi.fn()} />)
  fireEvent.click(screen.getByText('AI settings'))
  const key = await screen.findByLabelText(/API key/)
  expect(key).toHaveValue('')
  fireEvent.change(key, { target: { value: 'my-key' } })
  fireEvent.click(screen.getByText('Save AI settings'))
  await screen.findByText('Settings saved')
  expect(key).toHaveValue('')
  expect(SaveAISettings).toHaveBeenCalledWith(expect.anything(), 'my-key', false)
})
it('uses visible action buttons and highlights the save action', async () => {
  render(<AICommitAssistant hasStaged onApply={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'AI settings' }))
  const save = await screen.findByRole('button', { name: 'Save AI settings' })
  expect(save).toHaveClass('action-button', 'action-button--primary')
  expect(screen.getByRole('button', { name: 'AI settings' })).toHaveClass('action-button')
  expect(screen.getByRole('button', { name: 'Generate with AI' })).toHaveClass('action-button')
})
