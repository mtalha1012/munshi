import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ cases: [] as unknown[] }))

vi.mock('electron-store', () => {
  return {
    default: class {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get(_k: string): unknown { return h.cases }
      set(): void {}
    }
  }
})

import { getCases } from './store'

describe('store.getCases migration', () => {
  beforeEach(() => { h.cases = [] })

  it('migrates a legacy case with name + event.title into useSiteTitle=false', () => {
    h.cases = [{
      id: 'c1',
      caseNumber: '100200300',
      district: 'Lahore',
      name: 'Party A vs Party B',
      enabled: true,
      event: {
        title: 'Party A vs Party B',
        allDay: true,
        reminderMins: 1440
      },
      trackedEventId: 'evt-1',
      trackedHearingDate: '2026-09-07'
    }]

    const [c] = getCases()
    expect(c.titleFromSite).toBe(null)
    expect(c.event.useSiteTitle).toBe(false)
    expect(c.event.title).toBe('Party A vs Party B')
    // The old key must be gone.
    expect((c as unknown as { name?: string }).name).toBeUndefined()
  })

  it('is idempotent for an already-migrated case', () => {
    h.cases = [{
      id: 'c1',
      caseNumber: '100200300',
      district: 'Lahore',
      titleFromSite: 'Doctor Dina khan VS Shoukat Babar',
      enabled: true,
      event: {
        title: '',
        useSiteTitle: true,
        allDay: true,
        reminderMins: 1440
      },
      trackedEventId: null,
      trackedHearingDate: null
    }]

    const [c] = getCases()
    expect(c.titleFromSite).toBe('Doctor Dina khan VS Shoukat Babar')
    expect(c.event.useSiteTitle).toBe(true)
    expect(c.event.title).toBe('')
  })

  it('backfills a legacy case with only a title field (no name)', () => {
    h.cases = [{
      id: 'c1',
      caseNumber: '100200300',
      district: 'Lahore',
      title: 'Old title-only case',
      enabled: true,
      event: { title: '', allDay: true, reminderMins: 1440 },
      trackedEventId: null,
      trackedHearingDate: null
    }]

    const [c] = getCases()
    expect(c.titleFromSite).toBe(null)
    expect(c.event.useSiteTitle).toBe(false)
    expect(c.event.title).toBe('Old title-only case')
  })
})
