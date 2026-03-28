import { vi } from 'vitest'

// EventsOn returns an unsubscribe function — default returns a no-op vi.fn()
export const EventsOn = vi.fn((_event: string, _callback: (...data: unknown[]) => void) => vi.fn())
export const EventsOff = vi.fn()
export const EventsEmit = vi.fn()
export const BrowserOpenURL = vi.fn()
export const LogDebug = vi.fn()
export const LogError = vi.fn()
