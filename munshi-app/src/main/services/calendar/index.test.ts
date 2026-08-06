import { describe, it, expect, vi } from 'vitest'
import { ensureHearingEvent, type CalendarPort } from './index'
import type { CaseEventSpec } from '../../../shared/types'

const spec: CaseEventSpec = { title: 'Party A vs Party B', useSiteTitle: false, allDay: true, reminderMins: 1440 }

function makePort(over: Partial<CalendarPort> = {}): CalendarPort {
  return {
    getEvent: vi.fn(async () => null),
    insertEvent: vi.fn(async () => ({ id: 'new-evt' })),
    patchEventDates: vi.fn(async () => undefined),
    ...over
  }
}

describe('ensureHearingEvent', () => {
  it('creates an event when the case has none', async () => {
    const port = makePort()
    const r = await ensureHearingEvent({
      calendarId: 'primary', trackedEventId: null, spec,
      hearingDate: '2026-09-07', today: '2026-07-15', port
    })
    expect(r.status).toBe('created')
    expect(r.eventId).toBe('new-evt')
    expect(port.insertEvent).toHaveBeenCalledOnce()
  })

  it('re-creates when the tracked event was deleted (self-heal)', async () => {
    const port = makePort({ getEvent: vi.fn(async () => null) })
    const r = await ensureHearingEvent({
      calendarId: 'primary', trackedEventId: 'gone', spec,
      hearingDate: '2026-09-07', today: '2026-07-15', port
    })
    expect(r.status).toBe('recreated')
    expect(r.message).toMatch(/missing/i)
    expect(port.insertEvent).toHaveBeenCalledOnce()
  })

  it('does nothing when already on the hearing date', async () => {
    const port = makePort({
      getEvent: vi.fn(async () => ({ id: 'evt1', summary: 'X', start: { date: '2026-09-07' } }))
    })
    const r = await ensureHearingEvent({
      calendarId: 'primary', trackedEventId: 'evt1', spec,
      hearingDate: '2026-09-07', today: '2026-07-15', port
    })
    expect(r.status).toBe('noop')
    expect(port.insertEvent).not.toHaveBeenCalled()
    expect(port.patchEventDates).not.toHaveBeenCalled()
  })

  it('moves a future event on adjournment and never duplicates it', async () => {
    const port = makePort({
      getEvent: vi.fn(async () => ({ id: 'evt1', summary: 'X', start: { date: '2026-09-07' } }))
    })
    const r = await ensureHearingEvent({
      calendarId: 'primary', trackedEventId: 'evt1', spec,
      hearingDate: '2026-09-20', today: '2026-07-15', port
    })
    expect(r.status).toBe('moved')
    expect(r.eventId).toBe('evt1')
    expect(port.patchEventDates).toHaveBeenCalledOnce()
    expect(port.insertEvent).not.toHaveBeenCalled()
  })

  it('propagates a user edit when carrying forward to the next hearing', async () => {
    const port = makePort({
      getEvent: vi.fn(async () => ({
        id: 'old', summary: 'Renamed by user', description: 'my notes',
        start: { date: '2026-06-01' }, reminders: { useDefault: true }
      }))
    })
    const r = await ensureHearingEvent({
      calendarId: 'primary', trackedEventId: 'old', spec,
      hearingDate: '2026-09-07', today: '2026-07-15', port
    })
    expect(r.status).toBe('created')
    expect(r.eventId).toBe('new-evt')
    expect(r.spec.title).toBe('Renamed by user')
    expect(r.spec.description).toBe('my notes')
    const body = (port.insertEvent as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(body.summary).toBe('Renamed by user')
  })

  it('falls back to the saved spec when the event is gone (nothing to read)', async () => {
    const port = makePort({ getEvent: vi.fn(async () => null) })
    const r = await ensureHearingEvent({
      calendarId: 'primary', trackedEventId: 'gone', spec,
      hearingDate: '2026-09-07', today: '2026-07-15', port
    })
    expect(r.spec.title).toBe('Party A vs Party B')
  })
})

const withDesc = (call: unknown[]): unknown => call[4]

describe('ensureHearingEvent — stage/judge', () => {
  it('writes the managed description on create when tracking is on', async () => {
    const port = makePort()
    const r = await ensureHearingEvent({
      calendarId: 'primary', trackedEventId: null, spec, hearingDate: '2026-09-07',
      today: '2026-07-15', stage: 'Argument', judge: 'A. Judge', trackStage: true, trackJudges: true, port
    })
    const body = (port.insertEvent as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(body.description).toBe('Stage: Argument\nJudges:\n• A. Judge')
    expect(r.spec.description).toBe('Stage: Argument\nJudges:\n• A. Judge')
  })

  it('patches the description on move when tracking changes it', async () => {
    const port = makePort({
      getEvent: vi.fn(async () => ({ id: 'evt1', summary: 'X', start: { date: '2026-09-07' } }))
    })
    await ensureHearingEvent({
      calendarId: 'primary', trackedEventId: 'evt1', spec, hearingDate: '2026-09-20',
      today: '2026-07-15', stage: 'Argument', judge: 'A. Judge', trackStage: true, trackJudges: true, port
    })
    expect(withDesc((port.patchEventDates as ReturnType<typeof vi.fn>).mock.calls[0])).toBe(true)
  })

  it('does not patch the description on move when tracking is off', async () => {
    const port = makePort({
      getEvent: vi.fn(async () => ({ id: 'evt1', summary: 'X', start: { date: '2026-09-07' } }))
    })
    await ensureHearingEvent({
      calendarId: 'primary', trackedEventId: 'evt1', spec, hearingDate: '2026-09-20', today: '2026-07-15', port
    })
    expect(withDesc((port.patchEventDates as ReturnType<typeof vi.fn>).mock.calls[0])).toBe(false)
  })

  it('patches the description on a noop when tracking was just enabled', async () => {
    const port = makePort({
      getEvent: vi.fn(async () => ({ id: 'evt1', summary: 'X', start: { date: '2026-09-07' } }))
    })
    const r = await ensureHearingEvent({
      calendarId: 'primary', trackedEventId: 'evt1', spec, hearingDate: '2026-09-07',
      today: '2026-07-15', stage: 'Argument', judge: 'A. Judge', trackStage: true, trackJudges: true, port
    })
    expect(r.status).toBe('noop')
    expect(port.patchEventDates).toHaveBeenCalledOnce()
    expect(withDesc((port.patchEventDates as ReturnType<typeof vi.fn>).mock.calls[0])).toBe(true)
  })

  it('leaves a noop alone when the description is already current', async () => {
    const port = makePort({
      getEvent: vi.fn(async () => ({
        id: 'evt1', summary: 'X', start: { date: '2026-09-07' },
        description: 'Stage: Argument\nJudges:\n• A. Judge'
      }))
    })
    const r = await ensureHearingEvent({
      calendarId: 'primary', trackedEventId: 'evt1', spec, hearingDate: '2026-09-07',
      today: '2026-07-15', stage: 'Argument', judge: 'A. Judge', trackStage: true, trackJudges: true, port
    })
    expect(r.status).toBe('noop')
    expect(port.patchEventDates).not.toHaveBeenCalled()
  })
})
