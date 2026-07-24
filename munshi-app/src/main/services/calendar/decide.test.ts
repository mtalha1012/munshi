import { describe, it, expect } from 'vitest'
import { decideAction } from './decide'

const base = {
  trackedEventId: 'evt1',
  eventExists: true,
  eventDate: '2026-09-07',
  hearingDate: '2026-09-07',
  today: '2026-07-15'
}

describe('decideAction', () => {
  it('creates when the case has no tracked event yet', () => {
    expect(decideAction({ ...base, trackedEventId: null })).toEqual({
      kind: 'create',
      reason: 'no-tracked-event'
    })
  })

  it('re-creates when the tracked event was deleted in Google (self-heal)', () => {
    expect(decideAction({ ...base, eventExists: false, eventDate: null })).toEqual({
      kind: 'create',
      reason: 'event-missing'
    })
  })

  it('does nothing when the event already sits on the hearing date', () => {
    expect(decideAction(base)).toEqual({ kind: 'noop' })
  })

  it('MOVES the event when the hearing is adjourned and has not happened yet', () => {
    expect(decideAction({ ...base, hearingDate: '2026-09-20' })).toEqual({ kind: 'move' })
  })

  it('moves rather than duplicating even when the hearing is today', () => {
    expect(
      decideAction({ ...base, eventDate: '2026-07-15', hearingDate: '2026-07-20', today: '2026-07-15' })
    ).toEqual({ kind: 'move' })
  })

  it('creates a NEW event once the tracked hearing has passed (keeps history)', () => {
    expect(
      decideAction({ ...base, eventDate: '2026-06-01', hearingDate: '2026-09-07', today: '2026-07-15' })
    ).toEqual({ kind: 'create-next' })
  })

  it('creates next when the tracked event has no readable date', () => {
    expect(decideAction({ ...base, eventDate: null, hearingDate: '2026-09-07' })).toEqual({
      kind: 'create-next'
    })
  })

  it('re-creates a deleted event even when its stale date matches the hearing date', () => {
    expect(
      decideAction({ ...base, eventExists: false, eventDate: '2026-09-07', hearingDate: '2026-09-07' })
    ).toEqual({ kind: 'create', reason: 'event-missing' })
  })

  it('reports no-tracked-event rather than event-missing for a never-provisioned case', () => {
    expect(
      decideAction({ ...base, trackedEventId: null, eventExists: false, eventDate: null })
    ).toEqual({ kind: 'create', reason: 'no-tracked-event' })
  })
})
