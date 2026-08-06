import { calendar as calendarApi, calendar_v3 } from '@googleapis/calendar'
import { getAuthedClient, handleAuthExpiry, AuthExpiredError } from '../auth'
import { buildEventBody, eventDateOf } from './event-spec'
import { isGoneError, isAuthError } from './errors'
import type { CaseEventSpec } from '../../../shared/types'

export interface UpcomingEvent {
  id: string
  title: string
  date: string | null
  allDay: boolean
}

async function api(): Promise<calendar_v3.Calendar> {
  const auth = await getAuthedClient()
  // @googleapis/calendar nests its own google-auth-library copy, so its
  // OAuth2Client is a structurally identical but nominally distinct type from
  // the one auth.ts constructs. The cast bridges the two declarations; the
  // client it receives is a real OAuth2Client.
  return calendarApi({ version: 'v3', auth: auth as unknown as string })
}

// Runs a calendar operation and converts a dead-session failure (expired/revoked
// token surfaces here when googleapis tries to refresh) into a cleared session
// plus a friendly AuthExpiredError, instead of a raw 'invalid_grant'.
async function call<T>(fn: (cal: calendar_v3.Calendar) => Promise<T>): Promise<T> {
  const cal = await api()
  try {
    return await fn(cal)
  } catch (e) {
    if (isAuthError(e)) {
      handleAuthExpiry()
      throw new AuthExpiredError()
    }
    throw e
  }
}

export async function getEvent(
  calendarId: string,
  eventId: string
): Promise<calendar_v3.Schema$Event | null> {
  return call(async (cal) => {
    try {
      const res = await cal.events.get({ calendarId, eventId })
      if (!res.data || res.data.status === 'cancelled') return null
      return res.data
    } catch (e) {
      if (isGoneError(e)) return null
      throw e
    }
  })
}

export async function insertEvent(
  calendarId: string,
  body: calendar_v3.Schema$Event
): Promise<{ id: string; htmlLink?: string }> {
  return call(async (cal) => {
    const res = await cal.events.insert({ calendarId, requestBody: body })
    const id = res.data.id
    if (!id) throw new Error('Google did not return an event id.')
    return { id, htmlLink: res.data.htmlLink || undefined }
  })
}

// Patches start/end (and description/summary only when asked) so other edits survive.
export async function patchEventDates(
  calendarId: string,
  eventId: string,
  spec: CaseEventSpec,
  dateStr: string,
  withDescription = false,
  withSummary = false
): Promise<void> {
  const body = buildEventBody(spec, dateStr)
  const requestBody: calendar_v3.Schema$Event = { start: body.start, end: body.end }
  if (withDescription) requestBody.description = body.description ?? ''
  if (withSummary) requestBody.summary = body.summary ?? ''
  await call((cal) => cal.events.patch({ calendarId, eventId, requestBody }))
}

function toUpcomingEvents(items: calendar_v3.Schema$Event[] | undefined): UpcomingEvent[] {
  return (items || [])
    .filter((e) => !!e.id)
    .map((e) => ({
      id: e.id as string,
      title: e.summary || '(no title)',
      date: eventDateOf(e),
      allDay: !!e.start?.date
    }))
}

export async function listUpcoming(calendarId: string, max = 50): Promise<UpcomingEvent[]> {
  return call(async (cal) => {
    const res = await cal.events.list({
      calendarId,
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: max
    })
    return toUpcomingEvents(res.data.items)
  })
}

// Events that have already started, most recent first. `monthsBack` of null
// means "all time" — no lower bound. Google orders ascending, so the newest
// past event is last; reverse it since that's the one the user most likely
// wants to carry forward.
export async function listPast(
  calendarId: string,
  monthsBack: number | null = 6,
  max = 50
): Promise<UpcomingEvent[]> {
  return call(async (cal) => {
    const now = new Date()
    let timeMin: string | undefined
    if (monthsBack != null) {
      const from = new Date(now)
      from.setMonth(from.getMonth() - monthsBack)
      timeMin = from.toISOString()
    }
    const res = await cal.events.list({
      calendarId,
      timeMin,
      timeMax: now.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: max
    })
    return toUpcomingEvents(res.data.items).reverse()
  })
}

export async function testCalendarAccess(): Promise<boolean> {
  await call((cal) => cal.calendarList.list({ maxResults: 1 }))
  return true
}
