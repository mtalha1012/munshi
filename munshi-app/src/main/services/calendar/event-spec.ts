import type { calendar_v3 } from '@googleapis/calendar'
import type { CaseEventSpec } from '../../../shared/types'

const DEFAULT_REMINDER_MINS = 1440
const DEFAULT_DURATION_MINS = 60

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// UTC-only: local-midnight math shifts the day in positive-offset zones.
export function addDaysIso(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function defaultSpec(): CaseEventSpec {
  return { title: '', useSiteTitle: true, allDay: true, reminderMins: DEFAULT_REMINDER_MINS }
}

// Returns a shallow-cloned spec whose title is the effective calendar title.
// Never mutates the input.
export function resolveEventSpec(
  spec: CaseEventSpec,
  titleFromSite: string | null,
  caseNumber: string
): CaseEventSpec {
  const chosen = spec.useSiteTitle
    ? titleFromSite?.trim() || caseNumber
    : spec.title.trim() || caseNumber
  return { ...spec, title: chosen }
}

export function eventDateOf(ev: calendar_v3.Schema$Event): string | null {
  if (ev.start?.date) return ev.start.date
  if (ev.start?.dateTime) {
    const d = new Date(ev.start.dateTime)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  return null
}

function reminderFrom(ev: calendar_v3.Schema$Event): number | null {
  const r = ev.reminders
  if (!r || r.useDefault) return null
  const first = r.overrides?.[0]
  return typeof first?.minutes === 'number' ? first.minutes : null
}

// Stored so a deleted event can be rebuilt. Inherits useSiteTitle from the previous spec.
export function snapshotFrom(ev: calendar_v3.Schema$Event, previous: CaseEventSpec): CaseEventSpec {
  const allDay = !!ev.start?.date
  const spec: CaseEventSpec = {
    title: ev.summary || '',
    useSiteTitle: previous.useSiteTitle,
    allDay,
    reminderMins: reminderFrom(ev)
  }
  if (ev.description) spec.description = ev.description
  if (ev.location) spec.location = ev.location
  if (!allDay && ev.start?.dateTime) {
    const s = new Date(ev.start.dateTime)
    spec.startTime = `${pad(s.getHours())}:${pad(s.getMinutes())}`
    const e = ev.end?.dateTime
      ? new Date(ev.end.dateTime)
      : new Date(s.getTime() + DEFAULT_DURATION_MINS * 60000)
    spec.durationMins = Math.max(1, Math.round((e.getTime() - s.getTime()) / 60000))
  }
  return spec
}

export function buildEventBody(spec: CaseEventSpec, dateStr: string): calendar_v3.Schema$Event {
  const body: calendar_v3.Schema$Event = { summary: spec.title }
  if (spec.description) body.description = spec.description
  if (spec.location) body.location = spec.location

  if (spec.allDay) {
    body.start = { date: dateStr }
    body.end = { date: addDaysIso(dateStr, 1) }
  } else {
    const [h, m] = (spec.startTime || '09:00').split(':').map((n) => parseInt(n, 10))
    const start = new Date(`${dateStr}T${pad(h)}:${pad(m)}:00`)
    const end = new Date(start.getTime() + (spec.durationMins ?? DEFAULT_DURATION_MINS) * 60000)
    body.start = { dateTime: start.toISOString() }
    body.end = { dateTime: end.toISOString() }
  }

  body.reminders =
    spec.reminderMins == null
      ? { useDefault: true }
      : { useDefault: false, overrides: [{ method: 'popup', minutes: spec.reminderMins }] }

  return body
}
