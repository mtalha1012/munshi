import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CaseItem, CaseEventSpec, SaveCaseInput } from '../shared/types'

// Drives the ipcMain handlers against an in-memory store.
const h = vi.hoisted(() => ({
  handlers: new Map<string, (...a: unknown[]) => unknown>(),
  cases: [] as CaseItem[],
  settings: { calendarId: 'primary', runAtLogin: true, lastRunDate: null } as Record<
    string,
    unknown
  >,
  authStatus: vi.fn(() => ({ signedIn: true, email: null })),
  runSync: vi.fn(),
  getLastRun: vi.fn(),
  applyLoginItem: vi.fn(),
  checkForUpdates: vi.fn(),
  ensureHearingEvent: vi.fn(),
  listUpcoming: vi.fn(),
  listPast: vi.fn(),
  lookupOnce: vi.fn()
}))

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

vi.mock('electron', () => ({
  ipcMain: { handle: (ch: string, fn: (...a: unknown[]) => unknown) => h.handlers.set(ch, fn) },
  app: { getVersion: () => '9.9.9', getPath: () => '/tmp/userData' }
}))

vi.mock('./services/store', () => ({
  getCases: (): CaseItem[] => clone(h.cases),
  setCases: (c: CaseItem[]): CaseItem[] => {
    h.cases = clone(c)
    return clone(h.cases)
  },
  getSettings: () => clone(h.settings),
  setSettings: (patch: Record<string, unknown>) => {
    h.settings = { ...h.settings, ...patch }
    return clone(h.settings)
  }
}))

vi.mock('./services/auth', () => ({
  authStatus: h.authStatus,
  signIn: vi.fn(),
  signOut: vi.fn()
}))
vi.mock('./services/sync', () => ({ runSync: h.runSync, getLastRun: h.getLastRun }))
vi.mock('./services/scheduler', () => ({ applyLoginItem: h.applyLoginItem }))
vi.mock('./services/updater', () => ({ checkForUpdates: h.checkForUpdates }))
vi.mock('./services/calendar', () => ({
  ensureHearingEvent: h.ensureHearingEvent,
  listUpcoming: h.listUpcoming,
  listPast: h.listPast,
  defaultSpec: (): CaseEventSpec => ({
    title: '',
    useSiteTitle: true,
    allDay: true,
    reminderMins: 1440
  })
}))
vi.mock('./services/scraper', () => ({ lookupOnce: h.lookupOnce }))

import { registerIpc } from './ipc'

const spec = (over: Partial<CaseEventSpec> = {}): CaseEventSpec => ({
  title: 'Party A vs Party B',
  useSiteTitle: false,
  allDay: true,
  reminderMins: 1440,
  ...over
})

function makeCase(over: Partial<CaseItem> = {}): CaseItem {
  return {
    id: over.id ?? 'c1',
    caseNumber: over.caseNumber ?? '100200300',
    district: over.district ?? 'Lahore',
    titleFromSite: over.titleFromSite ?? null,
    enabled: over.enabled ?? true,
    event: over.event ?? spec(),
    trackedEventId: over.trackedEventId ?? null,
    trackedHearingDate: over.trackedHearingDate ?? null,
    lastKnownHearing: over.lastKnownHearing ?? null,
    lastSyncedAt: over.lastSyncedAt ?? null,
    lastStatus: over.lastStatus ?? null,
    needsAttention: over.needsAttention
  }
}

function call<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const fn = h.handlers.get(channel)
  if (!fn) throw new Error(`no handler for ${channel}`)
  return Promise.resolve(fn({}, ...args) as T)
}

const okLookup = { ok: true, nextHearing: '2026-09-07', allDates: [] }
const ensured = (over = {}) => ({
  status: 'created',
  message: 'Added hearing on 2026-09-07.',
  eventId: 'evt-new',
  spec: spec(),
  hearingDate: '2026-09-07',
  ...over
})

beforeEach(() => {
  h.handlers.clear()
  h.cases = []
  h.settings = { calendarId: 'primary', runAtLogin: true, lastRunDate: null }
  vi.clearAllMocks()
  h.authStatus.mockReturnValue({ signedIn: true, email: null })
  h.lookupOnce.mockResolvedValue(okLookup)
  h.ensureHearingEvent.mockResolvedValue(ensured())
  registerIpc(() => {})
})

describe('cases:save — new case', () => {
  it('creates a case flagged needsAttention with all fields populated', async () => {
    const input: SaveCaseInput = {
      caseNumber: '  100200300  ',
      district: 'Lahore',
      event: spec(),
      enabled: true
    }
    const result = (await call<CaseItem[]>('cases:save', input))!
    expect(result).toHaveLength(1)
    const c = result[0]
    expect(c.id).toBeTruthy()
    expect(c.caseNumber).toBe('100200300')
    expect(c.event.title).toBe('Party A vs Party B')
    expect(c.titleFromSite).toBeNull()
    expect(c.trackedEventId).toBeNull()
    expect(c.needsAttention).toBe(true)
  })

  it('falls back to defaultSpec for no event', async () => {
    const input = {
      caseNumber: '555',
      district: 'Lahore'
    } as unknown as SaveCaseInput
    const result = (await call<CaseItem[]>('cases:save', input))!
    expect(result[0].event).toEqual({
      title: '',
      useSiteTitle: true,
      allDay: true,
      reminderMins: 1440
    })
  })
})

describe('cases:save — existing case', () => {
  it('updates fields but preserves the tracked event when not overridden (no orphaning)', async () => {
    h.cases = [
      makeCase({
        id: 'c1',
        event: spec({ title: 'Old name' }),
        trackedEventId: 'evt-existing',
        trackedHearingDate: '2026-09-07'
      })
    ]
    const input: SaveCaseInput = {
      id: 'c1',
      caseNumber: '100200300',
      district: 'Lahore',
      event: spec({ title: 'New name' })
    }
    await call('cases:save', input)
    const c = h.cases[0]
    expect(c.event.title).toBe('New name')
    expect(c.trackedEventId).toBe('evt-existing')
    expect(c.trackedHearingDate).toBe('2026-09-07')
  })
})

describe('cases:provision — success', () => {
  it('persists the eventId, hearing date and refreshed spec and clears needsAttention', async () => {
    h.cases = [makeCase({ id: 'c1', trackedEventId: null, needsAttention: true })]
    h.ensureHearingEvent.mockResolvedValue(
      ensured({ eventId: 'evt-xyz', spec: spec({ title: 'From Google' }) })
    )

    const res = await call<{ ok: boolean; nextHearing?: string }>('cases:provision', 'c1')

    expect(res).toMatchObject({ ok: true, nextHearing: '2026-09-07' })
    const c = h.cases[0]
    expect(c.trackedEventId).toBe('evt-xyz')
    expect(c.trackedHearingDate).toBe('2026-09-07')
    expect(c.needsAttention).toBe(false)
    expect(c.event.title).toBe('From Google')
  })
})

describe('cases:provision — failure paths always flag the case', () => {
  it('a lookup that returns not-ok flags the case and keeps its tracked event', async () => {
    h.cases = [makeCase({ id: 'c1', trackedEventId: 'keep', needsAttention: false })]
    h.lookupOnce.mockResolvedValue({ ok: false, nextHearing: null, error: 'bad number' })

    const res = await call<{ ok: boolean }>('cases:provision', 'c1')

    expect(res.ok).toBe(false)
    expect(h.ensureHearingEvent).not.toHaveBeenCalled()
    expect(h.cases[0].needsAttention).toBe(true)
    expect(h.cases[0].trackedEventId).toBe('keep')
  })

  it('a lookup that THROWS is caught, returns ok:false, and still flags the case', async () => {
    h.cases = [makeCase({ id: 'c1', trackedEventId: 'keep' })]
    h.lookupOnce.mockRejectedValue(new Error('scraper window failed to open'))

    const res = await call<{ ok: boolean; message: string }>('cases:provision', 'c1')

    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/scraper window/)
    expect(h.cases[0].needsAttention).toBe(true)
  })

  it('a calendar error flags the case', async () => {
    h.cases = [makeCase({ id: 'c1', trackedEventId: 'keep' })]
    h.ensureHearingEvent.mockRejectedValue(new Error('google 500'))

    const res = await call<{ ok: boolean; message: string }>('cases:provision', 'c1')

    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/google 500/)
    expect(h.cases[0].needsAttention).toBe(true)
    expect(h.cases[0].trackedEventId).toBe('keep')
  })

  it('returns a clear message when the case no longer exists', async () => {
    h.cases = []
    const res = await call<{ ok: boolean; message: string }>('cases:provision', 'ghost')
    expect(res).toEqual({ ok: false, message: 'Case not found.' })
    expect(h.lookupOnce).not.toHaveBeenCalled()
  })
})

describe('cases:delete', () => {
  it('removes only the named case', async () => {
    h.cases = [makeCase({ id: 'a' }), makeCase({ id: 'b' })]
    const result = (await call<CaseItem[]>('cases:delete', 'a'))!
    expect(result.map((c) => c.id)).toEqual(['b'])
  })
})

describe('calendar:listPast', () => {
  it('passes an explicitly requested lookback straight through', async () => {
    h.settings = { calendarId: 'work@x.com', runAtLogin: true, pastLookbackMonths: 6 }

    await call('calendar:listPast', 12)

    expect(h.listPast).toHaveBeenCalledWith('work@x.com', 12)
  })

  it('falls back to the saved setting when no lookback is given', async () => {
    h.settings = { calendarId: 'primary', runAtLogin: true, pastLookbackMonths: 12 }

    await call('calendar:listPast')

    expect(h.listPast).toHaveBeenCalledWith('primary', 12)
  })

  it('treats an explicit null as "all time" rather than falling back', async () => {
    h.settings = { calendarId: 'primary', runAtLogin: true, pastLookbackMonths: 6 }

    await call('calendar:listPast', null)

    expect(h.listPast).toHaveBeenCalledWith('primary', null)
  })
})

describe('settings:set', () => {
  it('applies the login item only when runAtLogin actually changes', async () => {
    h.settings = { calendarId: 'primary', runAtLogin: true, lastRunDate: null }

    await call('settings:set', { calendarId: 'work@x.com' })
    expect(h.applyLoginItem).not.toHaveBeenCalled()

    await call('settings:set', { runAtLogin: false })
    expect(h.applyLoginItem).toHaveBeenCalledWith(false)
  })
})
