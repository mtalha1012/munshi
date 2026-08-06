import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CaseItem, CaseEventSpec } from '../shared/types'

// Real runSync + provision race; the lock must prevent a double-create.
const h = vi.hoisted(() => ({
  handlers: new Map<string, (...a: unknown[]) => unknown>(),
  cases: [] as CaseItem[],
  settings: { calendarId: 'primary', runAtLogin: true, lastRunDate: null } as Record<
    string,
    unknown
  >,
  lastRun: null as unknown,
  seenTrackedIds: [] as (string | null)[],
  createCount: 0
}))

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

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
  },
  getStore: () => ({
    get: (k: string) => (k === 'lastRun' ? h.lastRun : undefined),
    set: (k: string, v: unknown) => {
      if (k === 'lastRun') h.lastRun = v
    }
  })
}))

vi.mock('./services/auth', () => ({
  authStatus: () => ({ signedIn: true, email: null }),
  signIn: vi.fn(),
  signOut: vi.fn()
}))

const specDefault: CaseEventSpec = {
  title: 'Party A vs Party B',
  useSiteTitle: false,
  allDay: true,
  reminderMins: 1440
}

async function ensureHearingEvent(args: {
  trackedEventId: string | null
  hearingDate: string
}): Promise<{ status: string; message: string; eventId: string; spec: CaseEventSpec; hearingDate: string }> {
  h.seenTrackedIds.push(args.trackedEventId)
  await delay(5)
  if (args.trackedEventId === null) {
    h.createCount++
    return {
      status: 'created',
      message: 'Added hearing.',
      eventId: 'evt-created',
      spec: specDefault,
      hearingDate: args.hearingDate
    }
  }
  return {
    status: 'noop',
    message: 'Already on your calendar.',
    eventId: args.trackedEventId,
    spec: specDefault,
    hearingDate: args.hearingDate
  }
}

vi.mock('./services/calendar', () => ({
  ensureHearingEvent,
  listUpcoming: vi.fn(),
  defaultSpec: (): CaseEventSpec => ({
    title: '',
    useSiteTitle: true,
    allDay: true,
    reminderMins: 1440
  })
}))

async function lookup(): Promise<{ ok: boolean; nextHearing: string; allDates: string[] }> {
  await delay(5)
  return { ok: true, nextHearing: '2026-09-07', allDates: [] }
}
vi.mock('./services/scraper', () => ({
  lookupOnce: lookup,
  ScraperSession: class {
    init = async (): Promise<void> => {}
    lookup = lookup
    close = (): void => {}
  }
}))

vi.mock('./services/scheduler', () => ({ applyLoginItem: vi.fn() }))
vi.mock('./services/updater', () => ({ checkForUpdates: vi.fn() }))

import { runSync } from './services/sync'
import { registerIpc } from './ipc'

beforeEach(() => {
  h.handlers.clear()
  h.cases = [
    {
      id: 'c1',
      caseNumber: '100200300',
      district: 'Lahore',
      titleFromSite: null,
      enabled: true,
      event: specDefault,
      trackedEventId: null,
      trackedHearingDate: null,
      lastKnownHearing: null,
      lastSyncedAt: null,
      lastStatus: null,
      needsAttention: true
    }
  ]
  h.settings = { calendarId: 'primary', runAtLogin: true, lastRunDate: null }
  h.lastRun = null
  h.seenTrackedIds = []
  h.createCount = 0
  registerIpc(() => {})
})

describe('sync and provision cannot both create an event for the same case', () => {
  it('serialises via the shared lock: the second to run sees the first’s event id', async () => {
    const provision = h.handlers.get('cases:provision') as (...a: unknown[]) => Promise<unknown>

    await Promise.all([provision({}, 'c1'), runSync()])

    expect(h.seenTrackedIds).toHaveLength(2)
    expect(h.seenTrackedIds.filter((id) => id === null)).toHaveLength(1)
    expect(h.seenTrackedIds).toContain('evt-created')
    expect(h.createCount).toBe(1)
    expect(h.cases[0].trackedEventId).toBe('evt-created')
    expect(h.cases[0].needsAttention).toBe(false)
  })
})
