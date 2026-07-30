import Store from 'electron-store'
import type { CaseItem, CaseEventSpec, Settings } from '../../shared/types'
import { defaultSpec } from './calendar/event-spec'

interface StoreSchema {
  cases: CaseItem[]
  settings: Settings
  googleTokens: Record<string, unknown> | null
  googleEmail: string | null
  lastRun: unknown | null
}

const defaults: StoreSchema = {
  cases: [],
  settings: {
    calendarId: 'primary',
    runAtLogin: true,
    lastRunDate: null,
    pastLookbackMonths: 6
  },
  googleTokens: null,
  googleEmail: null,
  lastRun: null
}

let store: Store<StoreSchema> | null = null

export function getStore(): Store<StoreSchema> {
  if (!store) {
    store = new Store<StoreSchema>({ name: 'munshi-data', defaults })
  }
  return store
}

// Shape of cases written by older builds.
interface LegacyCase {
  title?: string
  calendarKeyword?: string
  name?: string
  event?: CaseEventSpec
  trackedEventId?: string | null
  trackedHearingDate?: string | null
  trackStage?: boolean
  trackJudges?: boolean
}

function migrate(raw: CaseItem & LegacyCase): CaseItem {
  const name = raw.name || raw.title || raw.caseNumber
  return {
    id: raw.id,
    caseNumber: raw.caseNumber,
    district: raw.district,
    name,
    enabled: raw.enabled ?? true,
    event: raw.event ?? defaultSpec(name),
    trackedEventId: raw.trackedEventId ?? null,
    trackedHearingDate: raw.trackedHearingDate ?? null,
    lastKnownHearing: raw.lastKnownHearing ?? null,
    lastSyncedAt: raw.lastSyncedAt ?? null,
    lastStatus: raw.lastStatus ?? null,
    needsAttention: raw.needsAttention ?? !raw.trackedEventId,
    trackStage: raw.trackStage ?? false,
    trackJudges: raw.trackJudges ?? false
  }
}

export function getCases(): CaseItem[] {
  const raw = (getStore().get('cases') as (CaseItem & LegacyCase)[]) || []
  return raw.map(migrate)
}

export function setCases(cases: CaseItem[]): CaseItem[] {
  getStore().set('cases', cases)
  return cases
}

export function getSettings(): Settings {
  const stored = getStore().get('settings')
  // electron-store only backfills defaults for missing top-level keys, so an
  // install that already has a settings object won't gain newly added fields.
  return {
    ...stored,
    pastLookbackMonths:
      stored.pastLookbackMonths === undefined ? 6 : stored.pastLookbackMonths
  }
}

export function setSettings(patch: Partial<Settings>): Settings {
  const merged = { ...getSettings(), ...patch }
  getStore().set('settings', merged)
  return merged
}
