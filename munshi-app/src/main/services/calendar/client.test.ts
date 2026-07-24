import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GaxiosError } from 'gaxios'

// Hoisted so the vi.mock factories (which are lifted above imports) can see them.
const { handleAuthExpiry, AuthExpiredError } = vi.hoisted(() => {
  class AuthExpiredError extends Error {
    constructor() {
      super('Your Google sign-in has expired. Please sign in again.')
      this.name = 'AuthExpiredError'
    }
  }
  return { handleAuthExpiry: vi.fn(), AuthExpiredError }
})

// Per-test control over what the calendar API call does (read lazily at call time).
let eventsList: () => Promise<unknown>

vi.mock('../auth', () => ({
  getAuthedClient: vi.fn(async () => ({})),
  handleAuthExpiry,
  AuthExpiredError
}))

vi.mock('googleapis', () => ({
  google: {
    calendar: () => ({
      events: { list: () => eventsList() }
    })
  }
}))

import { listUpcoming } from './client'

function gaxios(status: number, data: object): GaxiosError {
  return new GaxiosError('request failed', {}, {
    status,
    data,
    config: {},
    headers: {},
    statusText: ''
  } as never)
}

beforeEach(() => handleAuthExpiry.mockClear())

describe('calendar client auth handling', () => {
  it('clears the session and throws AuthExpiredError on invalid_grant', async () => {
    eventsList = () => Promise.reject(gaxios(400, { error: 'invalid_grant' }))
    await expect(listUpcoming('primary')).rejects.toBeInstanceOf(AuthExpiredError)
    expect(handleAuthExpiry).toHaveBeenCalledOnce()
  })

  it('rethrows a non-auth error and does NOT clear the session', async () => {
    eventsList = () => Promise.reject(gaxios(500, {}))
    await expect(listUpcoming('primary')).rejects.not.toBeInstanceOf(AuthExpiredError)
    expect(handleAuthExpiry).not.toHaveBeenCalled()
  })

  it('returns data on success without touching the session', async () => {
    eventsList = () =>
      Promise.resolve({
        data: { items: [{ id: 'e1', summary: 'Hearing', start: { date: '2026-09-07' } }] }
      })
    const rows = await listUpcoming('primary')
    expect(rows).toEqual([{ id: 'e1', title: 'Hearing', date: '2026-09-07', allDay: true }])
    expect(handleAuthExpiry).not.toHaveBeenCalled()
  })
})
