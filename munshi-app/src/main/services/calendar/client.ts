import { google, calendar_v3 } from 'googleapis'
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
  return google.calendar({ version: 'v3', auth })
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

// Patches start/end (and description only when asked) so other edits survive.
export async function patchEventDates(
  calendarId: string,
  eventId: string,
  spec: CaseEventSpec,
  dateStr: string,
  withDescription = false
): Promise<void> {
  const body = buildEventBody(spec, dateStr)
  const requestBody: calendar_v3.Schema$Event = { start: body.start, end: body.end }
  if (withDescription) requestBody.description = body.description ?? ''
  await call((cal) => cal.events.patch({ calendarId, eventId, requestBody }))
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
    return (res.data.items || [])
      .filter((e) => !!e.id)
      .map((e) => ({
        id: e.id as string,
        title: e.summary || '(no title)',
        date: eventDateOf(e),
        allDay: !!e.start?.date
      }))
  })
}

export async function testCalendarAccess(): Promise<boolean> {
  await call((cal) => cal.calendarList.list({ maxResults: 1 }))
  return true
}
