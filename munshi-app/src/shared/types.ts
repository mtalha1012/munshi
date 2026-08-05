export interface CaseEventSpec {
  title: string
  useSiteTitle: boolean
  allDay: boolean
  startTime?: string
  durationMins?: number
  reminderMins?: number | null
  description?: string
  location?: string
}

export interface CaseItem {
  id: string
  caseNumber: string
  district: string
  titleFromSite: string | null
  enabled: boolean

  event: CaseEventSpec
  trackedEventId: string | null
  trackedHearingDate: string | null

  lastKnownHearing?: string | null
  lastSyncedAt?: string | null
  lastStatus?: string | null
  needsAttention?: boolean

  trackStage?: boolean
  trackJudges?: boolean
}

export interface Settings {
  calendarId: string
  runAtLogin: boolean
  lastRunDate?: string | null
  // How far back the "Past" event picker looks. null = all time.
  pastLookbackMonths?: number | null
}

export interface AuthState {
  signedIn: boolean
  email?: string | null
}

export interface SyncCaseResult {
  caseId: string
  caseNumber: string
  ok: boolean
  nextHearing?: string | null
  message: string
}

export interface SyncRunResult {
  startedAt: string
  finishedAt: string
  results: SyncCaseResult[]
  summary: {
    processed: number
    added: number
    moved: number
    recreated: number
    skipped: number
    failed: number
  }
}

export interface SyncProgress {
  phase: 'start' | 'case' | 'done'
  message: string
  current?: number
  total?: number
}

export interface UpcomingEvent {
  id: string
  title: string
  date: string | null
  allDay: boolean
}

export interface SaveCaseInput {
  id?: string
  caseNumber: string
  district: string
  enabled?: boolean
  event: CaseEventSpec
  trackedEventId?: string | null
  trackStage?: boolean
  trackJudges?: boolean
}

export interface ProvisionResult {
  ok: boolean
  message: string
  nextHearing?: string | null
}

export interface LookupHearingResult {
  ok: boolean
  nextHearing?: string | null
  error?: string
}

// The API surface exposed to the renderer via the preload bridge.
export interface MunshiApi {
  getVersion(): Promise<string>

  authStatus(): Promise<AuthState>
  signIn(): Promise<AuthState>
  cancelSignIn(): Promise<void>
  signOut(): Promise<AuthState>

  listCases(): Promise<CaseItem[]>
  saveCase(input: SaveCaseInput): Promise<CaseItem[]>
  lookupHearing(caseNumber: string, district: string): Promise<LookupHearingResult>
  provisionCase(caseId: string): Promise<ProvisionResult>
  listUpcomingEvents(): Promise<UpcomingEvent[]>
  listPastEvents(monthsBack: number | null): Promise<UpcomingEvent[]>
  deleteCase(id: string): Promise<CaseItem[]>

  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>

  runNow(): Promise<SyncRunResult>
  getLastRun(): Promise<SyncRunResult | null>

  checkForUpdates(): Promise<{ checking: boolean; message: string }>
  installUpdate(): Promise<void>

  quit(): Promise<void>

  onSyncProgress(cb: (p: SyncProgress) => void): () => void
  onAuthExpired(cb: () => void): () => void
  onUpdateDownloaded(cb: (version: string) => void): () => void
}
