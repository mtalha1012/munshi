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
// Params the code passed to events.list, for asserting the time window.
let listParams: Record<string, unknown> = {}

vi.mock('../auth', () => ({
  getAuthedClient: vi.fn(async () => ({})),
  handleAuthExpiry,
  AuthExpiredError
}))

vi.mock('@googleapis/calendar', () => ({
  calendar: () => ({
    events: {
      list: (params: Record<string, unknown>) => {
        listParams = params
        return eventsList()
      }
    }
  })
}))

import { listUpcoming, listPast } from './client'

function gaxios(status: number, data: object): GaxiosError {
  return new GaxiosError('request failed', {}, {
    status,
    data,
    config: {},
    headers: {},
    statusText: ''
  } as never)
}

beforeEach(() => {
  handleAuthExpiry.mockClear()
  listParams = {}
})

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

describe('listPast', () => {
  const threeEvents = {
    data: {
      items: [
        { id: 'old', summary: 'First hearing', start: { date: '2026-05-11' } },
        { id: 'mid', summary: 'Second hearing', start: { date: '2026-06-02' } },
        { id: 'recent', summary: 'Third hearing', start: { date: '2026-07-01' } }
      ]
    }
  }

  it('asks only for events before now, newest first', async () => {
    eventsList = () => Promise.resolve(threeEvents)

    const rows = await listPast('primary', 6)

    // Google returns ascending; the most recent past event must come first.
    expect(rows.map((r) => r.id)).toEqual(['recent', 'mid', 'old'])
    expect(listParams.timeMax).toBeTruthy()
    expect(new Date(listParams.timeMax as string).getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('bounds the window to the requested number of months back', async () => {
    eventsList = () => Promise.resolve({ data: { items: [] } })

    await listPast('primary', 6)

    const timeMin = new Date(listParams.timeMin as string)
    const expected = new Date()
    expected.setMonth(expected.getMonth() - 6)
    // Same month boundary, allowing for the seconds the test takes to run.
    expect(Math.abs(timeMin.getTime() - expected.getTime())).toBeLessThan(60_000)
  })

  it('omits the lower bound entirely for "all time"', async () => {
    eventsList = () => Promise.resolve({ data: { items: [] } })

    await listPast('primary', null)

    expect(listParams.timeMin).toBeUndefined()
    expect(listParams.timeMax).toBeTruthy()
  })
})
