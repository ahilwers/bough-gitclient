import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LicenseDialog } from './LicenseDialog'
import { ActivateLicense } from '@wailsjs/go/main/App'
import type { LicenseStatus } from '@/stores/gitStore'

const trialStatus: LicenseStatus = {
  state: 'trial',
  daysLeft: 12,
  licenseKey: '',
  activatedAt: '',
  email: '',
}

const expiredStatus: LicenseStatus = {
  state: 'expired',
  daysLeft: 0,
  licenseKey: '',
  activatedAt: '',
  email: '',
}

const activeStatus: LicenseStatus = {
  state: 'active',
  daysLeft: 0,
  licenseKey: 'BOUGH-TEST-****-****-****',
  activatedAt: new Date().toISOString(),
  email: 'alice@example.com',
}

describe('LicenseDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows trial days remaining in title', () => {
    render(<LicenseDialog status={trialStatus} />)
    expect(screen.getByRole('heading')).toHaveTextContent('12')
  })

  it('shows expired title when trial is over', () => {
    render(<LicenseDialog status={expiredStatus} />)
    expect(screen.getByRole('heading')).toHaveTextContent(/expired/i)
  })

  it('renders the Buy Bough button', () => {
    render(<LicenseDialog status={trialStatus} />)
    expect(screen.getByRole('button', { name: /buy bough/i })).toBeInTheDocument()
  })

  it('shows the license key input', () => {
    render(<LicenseDialog status={trialStatus} />)
    expect(screen.getByLabelText(/license key/i)).toBeInTheDocument()
  })

  it('activate button is disabled when key field is empty', () => {
    render(<LicenseDialog status={trialStatus} />)
    const btn = screen.getByRole('button', { name: /^activate$/i })
    expect(btn).toBeDisabled()
  })

  it('activate button enabled when key is entered', () => {
    render(<LicenseDialog status={trialStatus} />)
    const input = screen.getByLabelText(/license key/i)
    fireEvent.change(input, { target: { value: 'BOUGH-ABCDEFGH-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX' } })
    const btn = screen.getByRole('button', { name: /^activate$/i })
    expect(btn).not.toBeDisabled()
  })

  it('calls ActivateLicense with the entered key', async () => {
    vi.mocked(ActivateLicense).mockResolvedValueOnce(activeStatus)
    render(<LicenseDialog status={trialStatus} />)

    const input = screen.getByLabelText(/license key/i)
    fireEvent.change(input, { target: { value: 'BOUGH-ABCDEFGH-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX' } })
    fireEvent.click(screen.getByRole('button', { name: /^activate$/i }))

    await waitFor(() =>
      expect(ActivateLicense).toHaveBeenCalledWith('BOUGH-ABCDEFGH-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX')
    )
  })

  it('shows error message on invalid key', async () => {
    vi.mocked(ActivateLicense).mockRejectedValueOnce(new Error('invalid license key format'))
    render(<LicenseDialog status={trialStatus} />)

    fireEvent.change(screen.getByLabelText(/license key/i), {
      target: { value: 'BOUGH-WRONG-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^activate$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('shows "Continue in Read-Only Mode" link during trial', () => {
    render(<LicenseDialog status={trialStatus} />)
    expect(screen.getByRole('button', { name: /read.only/i })).toBeInTheDocument()
  })

  it('does not show read-only link when expired', () => {
    render(<LicenseDialog status={expiredStatus} />)
    expect(screen.queryByRole('button', { name: /read.only/i })).not.toBeInTheDocument()
  })
})
