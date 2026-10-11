import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SOSStatus from './SOSStatus'
import ConfirmDialog from './ConfirmDialog'
import LocationProblem from './LocationProblem'
import { ToastProvider, useToast } from './Toast'
import { LanguageProvider } from '../i18n/LanguageContext'

const report = (status, extra = {}) => ({
  phase: 'done',
  event: { _id: 's1', notifications: [] },
  delivery: { notificationStatus: status, notificationMessage: `msg-${status}` },
  ...extra,
})

describe('SOSStatus never over-claims', () => {
  it('NOT_CONFIGURED says no contact was notified', () => {
    render(<LanguageProvider><SOSStatus report={report('NOT_CONFIGURED')} isAuthenticated /></LanguageProvider>)
    expect(screen.getByRole('alert')).toHaveTextContent(/No contact was notified/i)
    expect(screen.getByRole('alert')).not.toHaveTextContent(/contacts (were|have been) notified/i)
  })
  it('SENT wording is "handed to service", never "delivered"', () => {
    render(<LanguageProvider><SOSStatus report={report('SENT', { event: { _id: 's1', notifications: [{ channel: 'email', contactName: 'Mom', status: 'SENT' }] } })} isAuthenticated /></LanguageProvider>)
    expect(screen.getByRole('alert')).toHaveTextContent(/accepted by the notification service/i)
    expect(screen.getByRole('alert')).not.toHaveTextContent(/delivered/i)
    expect(screen.getByText(/Mom — email: accepted by service/)).toBeInTheDocument()
  })
  it('network error shows retry + call 112, and says the server alert was NOT sent', async () => {
    const onRetry = vi.fn()
    render(<LanguageProvider><SOSStatus report={{ phase: 'error', message: 'Offline.' }} onRetry={onRetry} /></LanguageProvider>)
    expect(screen.getByRole('alert')).toHaveTextContent(/NOT sent/)
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /112/ })).toHaveAttribute('href', 'tel:112')
  })
  it('sending state is announced politely', () => {
    render(<LanguageProvider><SOSStatus report={{ phase: 'sending' }} /></LanguageProvider>)
    expect(screen.getByRole('status')).toHaveTextContent(/Sending alert/)
  })
  it('renders nothing without a report', () => {
    const { container } = render(<LanguageProvider><SOSStatus report={null} /></LanguageProvider>)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ConfirmDialog accessibility', () => {
  it('is an labelled alertdialog, focuses Cancel, Escape cancels', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open title="Delete?" message="Sure?" onConfirm={() => {}} onCancel={onCancel} />)
    const dialog = screen.getByRole('alertdialog', { name: 'Delete?' })
    expect(dialog).toHaveAccessibleDescription('Sure?')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })
  it('traps Tab focus inside the dialog', async () => {
    render(<ConfirmDialog open title="T" message="M" confirmLabel="Yes" onConfirm={() => {}} onCancel={() => {}} />)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })
  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmDialog open={false} title="x" message="y" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('LocationProblem', () => {
  it('shows an actionable message and retry', async () => {
    const onRetry = vi.fn()
    render(<LocationProblem code="PERMISSION_DENIED" onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/permission is blocked/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/SOS still works without GPS/)
    await userEvent.click(screen.getByRole('button', { name: /retry location/i }))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('Toast', () => {
  it('announces errors with role=alert and can be dismissed', async () => {
    function Trigger() { const t = useToast(); return <button onClick={() => t.error('Boom')}>go</button> }
    render(<ToastProvider><Trigger /></ToastProvider>)
    await userEvent.click(screen.getByText('go'))
    expect(screen.getByRole('alert')).toHaveTextContent('Boom')
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
