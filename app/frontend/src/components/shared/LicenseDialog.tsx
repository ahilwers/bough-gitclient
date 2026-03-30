import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserOpenURL } from '@wailsjs/runtime/runtime'
import { ActivateLicense } from '@wailsjs/go/main/App'
import { useGitStore, type LicenseStatus } from '../../stores/gitStore'

const PURCHASE_URL = 'https://bough.app/buy'

interface Props {
  status: LicenseStatus
}

export function LicenseDialog({ status }: Props) {
  const { t } = useTranslation()
  const { setLicenseStatus, setLicenseDialogOpen } = useGitStore()
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)

  const isExpired = status.state === 'expired' || status.state === 'invalid'
  const isTrial = status.state === 'trial'

  async function handleActivate() {
    const trimmed = key.trim().toUpperCase()
    if (!trimmed) {
      setError(t('license.error.emptyKey'))
      return
    }
    setError(null)
    setActivating(true)
    try {
      const newStatus = await ActivateLicense(trimmed)
      setLicenseStatus(newStatus)
      setLicenseDialogOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('invalid')) {
        setError(t('license.error.invalidKey'))
      } else if (msg.includes('network') || msg.includes('connection')) {
        setError(t('license.error.networkError'))
      } else {
        setError(t('license.error.activationFailed'))
      }
    } finally {
      setActivating(false)
    }
  }

  function handleBuy() {
    BrowserOpenURL(PURCHASE_URL)
  }

  function handleDismiss() {
    setLicenseDialogOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-dialog-title"
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '32px 36px',
          width: 460,
          maxWidth: '90vw',
        }}
      >
        {/* Header */}
        <h2 id="license-dialog-title" style={{ margin: '0 0 8px', color: 'var(--text-pri)', fontSize: 18 }}>
          {isTrial
            ? t('license.dialog.trialTitle', { days: status.daysLeft })
            : t('license.dialog.expiredTitle')}
        </h2>

        {isTrial && (
          <p style={{ margin: '0 0 20px', color: 'var(--text-sec)', fontSize: 14 }}>
            {t('license.dialog.trialSubtitle')}
          </p>
        )}
        {isExpired && (
          <p style={{ margin: '0 0 20px', color: 'var(--danger)', fontSize: 14 }}>
            {t('license.dialog.expiredSubtitle')}
          </p>
        )}

        {/* Buy button */}
        <button
          onClick={handleBuy}
          style={{
            width: '100%', padding: '10px 0', marginBottom: 16,
            background: 'var(--acc)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer', fontWeight: 600,
          }}
        >
          {t('license.dialog.buyButton')}
        </button>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          color: 'var(--text-ter)', fontSize: 12,
        }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-sub)' }} />
          {t('license.dialog.orEnterKey')}
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-sub)' }} />
        </div>

        {/* Key input */}
        <input
          type="text"
          value={key}
          onChange={e => { setKey(e.target.value); setError(null) }}
          onKeyDown={e => e.key === 'Enter' && handleActivate()}
          placeholder="BOUGH-XXXXXXXX-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX"
          aria-label={t('license.dialog.keyInputLabel')}
          disabled={activating}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '8px 12px', marginBottom: 8,
            background: 'var(--bg-content)', color: 'var(--text-pri)',
            border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 6, fontSize: 13, fontFamily: 'monospace',
          }}
        />
        {error && (
          <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 8px' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleActivate}
          disabled={activating || !key.trim()}
          style={{
            width: '100%', padding: '8px 0', marginBottom: 12,
            background: activating ? 'var(--border)' : 'var(--bg-content)',
            color: 'var(--text-pri)',
            border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, cursor: activating ? 'wait' : 'pointer',
          }}
        >
          {activating ? t('license.dialog.activating') : t('license.dialog.activateButton')}
        </button>

        {/* Read-only dismiss (only in trial, not when expired) */}
        {isTrial && (
          <button
            onClick={handleDismiss}
            style={{
              width: '100%', background: 'none', border: 'none',
              color: 'var(--text-sec)', fontSize: 13, cursor: 'pointer',
              textDecoration: 'underline', padding: 0,
            }}
          >
            {t('license.dialog.continueReadOnly')}
          </button>
        )}
      </div>
    </div>
  )
}
