/**
 * components/ConnectivityPanel.jsx
 *
 * Plain-language "what works offline / what needs internet" panel. Never claims
 * an internet-dependent feature works offline.
 */
import { useConnectivity, useSyncStatus } from '../hooks/useConnectivity'
import { useLanguage } from '../i18n/LanguageContext'

export default function ConnectivityPanel({ defaultOpen = false }) {
  const { t } = useLanguage()
  const conn = useConnectivity()
  const sync = useSyncStatus()
  const label = conn === 'online' ? '🟢 Online' : conn === 'offline' ? `🔴 ${t('conn.offline')}` : '🟠 Server unreachable'

  return (
    <details open={defaultOpen} style={{ background: '#fff', borderRadius: 14, padding: '10px 14px', margin: '0 0 14px', border: '1px solid rgba(194,24,91,0.15)' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#880e4f', fontSize: 14, minHeight: 32 }}>
        {label} · {t('conn.available')} / {t('conn.required')}
      </summary>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55 }}>
        <p style={{ margin: '0 0 8px', color: '#1b5e20' }}><b>✅ {t('conn.available')}:</b> {t('conn.available.list')}</p>
        <p style={{ margin: '0 0 8px', color: '#b71c1c' }}><b>🌐 {t('conn.required')}:</b> {t('conn.required.list')}</p>
        {sync.pending > 0 && <p role="status" style={{ margin: 0, color: '#7a3d00' }}>⏳ {t('sync.pending', { n: sync.pending })}</p>}
      </div>
    </details>
  )
}
