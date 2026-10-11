import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  try { localStorage.clear() } catch { /* ignore */ }
})

// jsdom does not implement these browser APIs.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
