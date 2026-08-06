import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CaseItem, CaseEventSpec } from '../../shared/types'

// Fakes sync.ts's services so runSync runs without Electron.
const h = vi.hoisted(() => ({
  cases: [] as CaseItem[],
  settings: { calendarId: 'primary', runAtLogin: true, lastRunDate: null } as Record<
    string,
    unknown
  >,
  lastRun: null as unknown,
  signedIn: true,
  ensureHearingEvent: vi.fn(),
  lookup: vi.fn(),
  scraperInit: vi.fn(),
  scraperClose: vi.fn()
}))

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

vi.mock('./store', () => ({
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

vi.mock('./auth', () => ({ authStatus: () => ({ signedIn: h.signedIn, email: null }) }))
vi.mock('./calendar', () => ({ ensureHearingEvent: h.ensureHearingEvent }))
vi.mock('./scraper', () => ({
  ScraperSession: class {
    init = h.scraperInit
    lookup = h.lookup
    close = h.scraperClose
  }
}))

import { runSync, getLastRun } from './sync'
import { setCases as fakeSetCases } from './store'

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
  h.cases = []
  h.settings = { calendarId: 'primary', runAtLogin: true, lastRunDate: null }
  h.lastRun = null
  h.signedIn = true
  vi.clearAllMocks()
  h.scraperInit.mockResolvedValue(undefined)
  h.scraperClose.mockReturnValue(undefined)
  h.lookup.mockResolvedValue(okLookup)
  h.ensureHearingEvent.mockResolvedValue(ensured())
})

describe('runSync — counter mapping', () => {
  it('reports created / moved / recreated / noop as distinct counts', async () => {
    h.cases = [
      makeCase({ id: 'a', caseNumber: '1', trackedEventId: null }),
      makeCase({ id: 'b', caseNumber: '2', trackedEventId: 'e-b' }),
      makeCase({ id: 'c', caseNumber: '3', trackedEventId: 'e-c' }),
      makeCase({ id: 'd', caseNumber: '4', trackedEventId: 'e-d' })
    ]
    const byCase: Record<string, string> = { '1': 'created', '2': 'moved', '3': 'recreated', '4': 'noop' }
    h.ensureHearingEvent.mockImplementation(async (args: { trackedEventId: string | null }) => {
      const status =
        args.trackedEventId === null
          ? 'created'
          : args.trackedEventId === 'e-b'
            ? 'moved'
            : args.trackedEventId === 'e-c'
              ? 'recreated'
              : 'noop'
      return ensured({ status, eventId: args.trackedEventId ?? 'evt-new' })
    })
    void byCase

    const run = await runSync()
    expect(run.summary).toEqual({
      processed: 4,
      added: 1,
      moved: 1,
      recreated: 1,
      skipped: 1,
      failed: 0
    })
  })
})

describe('runSync — failure handling & no orphaning', () => {
  it('a failed lookup flags the case and does NOT touch the calendar or its tracked event', async () => {
    h.cases = [makeCase({ id: 'a', trackedEventId: 'keep-me' })]
    h.lookup.mockResolvedValue({ ok: false, nextHearing: null, error: 'not found on site' })

    const run = await runSync()

    expect(h.ensureHearingEvent).not.toHaveBeenCalled()
    expect(run.summary.failed).toBe(1)
    const c = h.cases[0]
    expect(c.needsAttention).toBe(true)
    expect(c.trackedEventId).toBe('keep-me')
  })

  it('a calendar error flags the case and keeps its prior tracked event', async () => {
    h.cases = [makeCase({ id: 'a', trackedEventId: 'keep-me' })]
    h.ensureHearingEvent.mockRejectedValue(new Error('google down'))

    const run = await runSync()

    expect(run.summary.failed).toBe(1)
    expect(h.cases[0].needsAttention).toBe(true)
    expect(h.cases[0].trackedEventId).toBe('keep-me')
    expect(h.cases[0].lastStatus).toMatch(/google down/)
  })
})

describe('runSync — persistence of the refreshed spec', () => {
  it('persists the eventId, hearing date and Google-refreshed spec on success', async () => {
    h.cases = [makeCase({ id: 'a', trackedEventId: null, needsAttention: true })]
    h.ensureHearingEvent.mockResolvedValue(
      ensured({ eventId: 'evt-xyz', spec: spec({ title: 'Renamed in Google' }), status: 'created' })
    )

    await runSync()

    const c = h.cases[0]
    expect(c.trackedEventId).toBe('evt-xyz')
    expect(c.trackedHearingDate).toBe('2026-09-07')
    expect(c.needsAttention).toBe(false)
    expect(c.event.title).toBe('Renamed in Google')
    expect(c.lastKnownHearing).toBe('2026-09-07')
  })
})

describe('runSync — per-case error isolation', () => {
  it('one failing case does not abort the rest, and the scraper is always closed', async () => {
    h.cases = [
      makeCase({ id: 'a', caseNumber: '1', trackedEventId: 'e-a' }),
      makeCase({ id: 'b', caseNumber: '2', trackedEventId: 'e-b' }),
      makeCase({ id: 'c', caseNumber: '3', trackedEventId: 'e-c' })
    ]
    h.ensureHearingEvent.mockImplementation(async (args: { trackedEventId: string | null }) => {
      if (args.trackedEventId === 'e-b') throw new Error('boom')
      return ensured({ status: 'noop', eventId: args.trackedEventId ?? 'x' })
    })

    const run = await runSync()

    expect(run.summary).toMatchObject({ processed: 3, failed: 1, skipped: 2 })
    expect(run.results).toHaveLength(3)
    expect(h.scraperClose).toHaveBeenCalledTimes(1)
    expect(h.cases[2].needsAttention).toBe(false)
  })
})

describe('runSync — guards', () => {
  it('throws when not signed in to Google', async () => {
    h.signedIn = false
    h.cases = [makeCase()]
    await expect(runSync()).rejects.toThrow(/signed in/i)
  })

  it('rejects a second run while one is already in progress', async () => {
    h.cases = [makeCase()]
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    h.lookup.mockImplementation(async () => {
      await gate
      return okLookup
    })
    const first = runSync()
    await expect(runSync()).rejects.toThrow(/already in progress/i)
    release()
    await first
  })

  it('writes an all-zero run when there are no enabled cases', async () => {
    h.cases = [makeCase({ enabled: false })]
    const run = await runSync()
    expect(run.summary).toEqual({
      processed: 0,
      added: 0,
      moved: 0,
      recreated: 0,
      skipped: 0,
      failed: 0
    })
    expect(getLastRun()).toEqual(run)
  })
})

describe('updateCaseAfterSync — re-reads before writing (no clobber)', () => {
  it('does not revert a write another path made during the sync', async () => {
    h.cases = [makeCase({ id: 'a', trackedEventId: null })]
    h.ensureHearingEvent.mockImplementation(async () => {
      fakeSetCases([...h.cases, makeCase({ id: 'injected', caseNumber: '999' })])
      return ensured({ eventId: 'evt-a', status: 'created' })
    })

    await runSync()

    const ids = h.cases.map((c) => c.id).sort()
    expect(ids).toContain('injected')
    expect(ids).toContain('a')
    expect(h.cases.find((c) => c.id === 'a')?.trackedEventId).toBe('evt-a')
  })
})

describe('runSync titleFromSite handling', () => {
  beforeEach(() => {
    h.cases = []
    h.lastRun = null
    h.ensureHearingEvent.mockReset()
    h.lookup.mockReset()
    h.scraperInit.mockReset()
    h.scraperClose.mockReset()
  })

  it('writes titleFromSite when the scraper returns a title', async () => {
    fakeSetCases([makeCase()])
    h.lookup.mockResolvedValue({
      ...okLookup,
      title: 'Doctor Dina khan VS Shoukat Babar'
    })
    h.ensureHearingEvent.mockResolvedValue(ensured())

    await runSync()

    expect(h.cases[0].titleFromSite).toBe('Doctor Dina khan VS Shoukat Babar')
  })

  it('does not clobber an existing titleFromSite when the scraper omits it', async () => {
    fakeSetCases([makeCase({ titleFromSite: 'Previously fetched title' })])
    h.lookup.mockResolvedValue({ ...okLookup /* no title */ })
    h.ensureHearingEvent.mockResolvedValue(ensured())

    await runSync()

    expect(h.cases[0].titleFromSite).toBe('Previously fetched title')
  })

  it('passes the resolved effective title to ensureHearingEvent', async () => {
    fakeSetCases([
      makeCase({
        titleFromSite: 'Doctor Dina khan VS Shoukat Babar',
        event: spec({ useSiteTitle: true, title: 'ignored custom' })
      })
    ])
    h.lookup.mockResolvedValue({ ...okLookup, title: 'Doctor Dina khan VS Shoukat Babar' })
    h.ensureHearingEvent.mockResolvedValue(ensured())

    await runSync()

    const call = h.ensureHearingEvent.mock.calls[0][0]
    expect(call.spec.title).toBe('Doctor Dina khan VS Shoukat Babar')
  })
})
