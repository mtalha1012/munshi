import { describe, it, expect } from 'vitest'
import { addDaysIso, eventDateOf, snapshotFrom, buildEventBody, defaultSpec, resolveEventSpec } from './event-spec'
import type { CaseEventSpec } from '../../../shared/types'

describe('addDaysIso', () => {
  it('adds a day without a timezone roll-back', () => {
    expect(addDaysIso('2026-09-07', 1)).toBe('2026-09-08')
  })
  it('crosses month and year boundaries', () => {
    expect(addDaysIso('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('buildEventBody', () => {
  it('all-day: end date is exclusive (start + 1)', () => {
    const body = buildEventBody({ title: 'Party A vs Party B', useSiteTitle: true, allDay: true, reminderMins: 1440 }, '2026-09-07')
    expect(body.start?.date).toBe('2026-09-07')
    expect(body.end?.date).toBe('2026-09-08')
    expect(body.summary).toBe('Party A vs Party B')
  })
  it('all-day default carries a 1-day-before reminder', () => {
    const body = buildEventBody({ title: 'X', useSiteTitle: true, allDay: true, reminderMins: 1440 }, '2026-09-07')
    expect(body.reminders).toEqual({ useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] })
  })
  it('null reminder means use the calendar default', () => {
    const body = buildEventBody({ title: 'X', useSiteTitle: true, allDay: true, reminderMins: null }, '2026-09-07')
    expect(body.reminders).toEqual({ useDefault: true })
  })
  it('timed: keeps wall-clock time and duration', () => {
    const body = buildEventBody(
      { title: 'X', allDay: false, startTime: '09:30', durationMins: 45 },
      '2026-09-07'
    )
    const s = new Date(body.start!.dateTime!)
    const e = new Date(body.end!.dateTime!)
    expect(s.getHours()).toBe(9)
    expect(s.getMinutes()).toBe(30)
    expect(s.getDate()).toBe(7)
    expect((e.getTime() - s.getTime()) / 60000).toBe(45)
  })
})

describe('eventDateOf', () => {
  it('reads an all-day date', () => {
    expect(eventDateOf({ start: { date: '2026-09-07' } })).toBe('2026-09-07')
  })
  it('reads a timed event as its LOCAL date', () => {
    const dt = new Date(2026, 8, 7, 9, 0, 0).toISOString()
    expect(eventDateOf({ start: { dateTime: dt } })).toBe('2026-09-07')
  })
  it('reads a timed event as its LOCAL date, even when that crosses UTC midnight', () => {
    const dt = new Date(2026, 8, 7, 1, 0, 0).toISOString()
    expect(eventDateOf({ start: { dateTime: dt } })).toBe('2026-09-07')
  })
  it('returns null when there is no start', () => {
    expect(eventDateOf({})).toBeNull()
  })
})

describe('snapshotFrom', () => {
  it('round-trips an all-day event', () => {
    const spec = snapshotFrom({
      summary: 'Hearing',
      start: { date: '2026-09-07' },
      end: { date: '2026-09-08' },
      description: 'notes',
      location: 'Court 4',
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] }
    })
    expect(spec).toEqual({
      title: 'Hearing',
      allDay: true,
      description: 'notes',
      location: 'Court 4',
      reminderMins: 1440
    })
  })
  it('round-trips a timed event', () => {
    const start = new Date(2026, 8, 7, 9, 30, 0)
    const end = new Date(2026, 8, 7, 10, 15, 0)
    const spec = snapshotFrom({
      summary: 'Hearing',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() }
    })
    expect(spec.allDay).toBe(false)
    expect(spec.startTime).toBe('09:30')
    expect(spec.durationMins).toBe(45)
  })
  it('captures a user edit to the title (this is how edits propagate)', () => {
    const spec = snapshotFrom({ summary: 'Renamed by user', start: { date: '2026-09-07' } })
    expect(spec.title).toBe('Renamed by user')
  })
  it('useDefault reminders snapshot back to null', () => {
    const spec = snapshotFrom({ summary: 'X', start: { date: '2026-09-07' }, reminders: { useDefault: true } })
    expect(spec.reminderMins).toBeNull()
  })
})

describe('resolveEventSpec', () => {
  const base: CaseEventSpec = {
    title: 'My Custom Title',
    useSiteTitle: false,
    allDay: true,
    reminderMins: 1440
  }

  it('uses the custom title when useSiteTitle is false', () => {
    const out = resolveEventSpec(base, 'Site Title', '100200300')
    expect(out.title).toBe('My Custom Title')
    expect(out).not.toBe(base)
  })

  it('falls back to case number when custom title is blank', () => {
    const out = resolveEventSpec({ ...base, title: '   ' }, 'Site Title', '100200300')
    expect(out.title).toBe('100200300')
  })

  it('uses the site title when useSiteTitle is true and titleFromSite is set', () => {
    const out = resolveEventSpec(
      { ...base, useSiteTitle: true, title: 'stale custom' },
      'Doctor Dina khan VS Shoukat Babar',
      '100200300'
    )
    expect(out.title).toBe('Doctor Dina khan VS Shoukat Babar')
  })

  it('falls back to case number when useSiteTitle is true but titleFromSite is missing', () => {
    const out = resolveEventSpec(
      { ...base, useSiteTitle: true, title: '' },
      null,
      '100200300'
    )
    expect(out.title).toBe('100200300')
  })
})

describe('defaultSpec', () => {
  it('defaults new cases to useSiteTitle=true and an empty custom title', () => {
    expect(defaultSpec()).toEqual({
      title: '',
      useSiteTitle: true,
      allDay: true,
      reminderMins: 1440
    })
  })
})
