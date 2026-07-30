import type { calendar_v3 } from 'googleapis'
import type { CaseEventSpec } from '../../../shared/types'
import { decideAction } from './decide'
import { buildEventBody, eventDateOf, snapshotFrom } from './event-spec'
import { applyManagedDescription } from './description'
import * as realClient from './client'

export { listUpcoming, listPast, testCalendarAccess, type UpcomingEvent } from './client'
export { defaultSpec } from './event-spec'

export interface CalendarPort {
  getEvent(calendarId: string, eventId: string): Promise<calendar_v3.Schema$Event | null>
  insertEvent(
    calendarId: string,
    body: calendar_v3.Schema$Event
  ): Promise<{ id: string; htmlLink?: string }>
  patchEventDates(
    calendarId: string,
    eventId: string,
    spec: CaseEventSpec,
    dateStr: string,
    withDescription?: boolean
  ): Promise<void>
}

export interface EnsureArgs {
  calendarId: string
  trackedEventId: string | null
  spec: CaseEventSpec
  hearingDate: string
  today?: string
  stage?: string
  judge?: string
  trackStage?: boolean
  trackJudges?: boolean
  port?: CalendarPort
}

export interface EnsureResult {
  status: 'created' | 'recreated' | 'moved' | 'noop'
  message: string
  eventId: string
  spec: CaseEventSpec
  hearingDate: string
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Re-snapshots the spec on each read so Google edits propagate.
export async function ensureHearingEvent(args: EnsureArgs): Promise<EnsureResult> {
  const port = args.port ?? realClient
  const today = args.today ?? todayIso()

  const existing = args.trackedEventId
    ? await port.getEvent(args.calendarId, args.trackedEventId)
    : null

  const spec = existing ? snapshotFrom(existing) : args.spec

  const nextDescription = applyManagedDescription(
    spec.description,
    { stage: args.stage, judge: args.judge },
    { trackStage: !!args.trackStage, trackJudges: !!args.trackJudges }
  )
  const descChanged = nextDescription !== (spec.description ?? '')
  const outSpec: CaseEventSpec = { ...spec, description: nextDescription || undefined }

  const action = decideAction({
    trackedEventId: args.trackedEventId,
    eventExists: !!existing,
    eventDate: existing ? eventDateOf(existing) : null,
    hearingDate: args.hearingDate,
    today
  })

  switch (action.kind) {
    case 'noop': {
      if (descChanged) {
        await port.patchEventDates(
          args.calendarId,
          args.trackedEventId as string,
          outSpec,
          args.hearingDate,
          true
        )
      }
      return {
        status: 'noop',
        message: `Already on your calendar for ${args.hearingDate}.`,
        eventId: args.trackedEventId as string,
        spec: outSpec,
        hearingDate: args.hearingDate
      }
    }

    case 'move':
      await port.patchEventDates(
        args.calendarId,
        args.trackedEventId as string,
        outSpec,
        args.hearingDate,
        descChanged
      )
      return {
        status: 'moved',
        message: `Hearing moved to ${args.hearingDate}.`,
        eventId: args.trackedEventId as string,
        spec: outSpec,
        hearingDate: args.hearingDate
      }

    case 'create-next': {
      const created = await port.insertEvent(
        args.calendarId,
        buildEventBody(outSpec, args.hearingDate)
      )
      return {
        status: 'created',
        message: `Added hearing on ${args.hearingDate}.`,
        eventId: created.id,
        spec: outSpec,
        hearingDate: args.hearingDate
      }
    }

    case 'create': {
      const created = await port.insertEvent(
        args.calendarId,
        buildEventBody(outSpec, args.hearingDate)
      )
      return {
        status: action.reason === 'event-missing' ? 'recreated' : 'created',
        message:
          action.reason === 'event-missing'
            ? `The calendar event was missing — re-created it on ${args.hearingDate}.`
            : `Added hearing on ${args.hearingDate}.`,
        eventId: created.id,
        spec: outSpec,
        hearingDate: args.hearingDate
      }
    }
  }
}
