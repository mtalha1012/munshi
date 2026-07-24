export type EventAction =
  | { kind: 'create'; reason: 'no-tracked-event' | 'event-missing' }
  | { kind: 'noop' }
  | { kind: 'move' }
  | { kind: 'create-next' }

export interface DecideInput {
  trackedEventId: string | null
  eventExists: boolean
  eventDate: string | null
  hearingDate: string
  today: string
}

// Dates are yyyy-mm-dd, so string compare is date compare.
export function decideAction(i: DecideInput): EventAction {
  if (!i.trackedEventId) return { kind: 'create', reason: 'no-tracked-event' }
  if (!i.eventExists) return { kind: 'create', reason: 'event-missing' }
  if (i.eventDate === i.hearingDate) return { kind: 'noop' }
  if (i.eventDate !== null && i.eventDate >= i.today) return { kind: 'move' }
  return { kind: 'create-next' }
}
