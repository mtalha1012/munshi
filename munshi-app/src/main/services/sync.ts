import { getCases, setCases, getStore, setSettings, getSettings } from './store'
import { authStatus } from './auth'
import { ensureHearingEvent } from './calendar'
import { ScraperSession } from './scraper'
import { calendarLock } from './mutex'
import type { SyncRunResult, SyncCaseResult, SyncProgress, CaseItem } from '../../shared/types'

let running = false

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function summarize(summary: SyncRunResult['summary']): string {
  const parts: string[] = []
  if (summary.added > 0) parts.push(`Added ${summary.added}`)
  if (summary.moved > 0) parts.push(`moved ${summary.moved}`)
  if (summary.recreated > 0) parts.push(`re-created ${summary.recreated}`)
  if (summary.skipped > 0) parts.push(`already there ${summary.skipped}`)
  if (summary.failed > 0) parts.push(`failed ${summary.failed}`)

  if (parts.length === 0) return 'Done. Nothing to do.'

  const [first, ...rest] = parts
  const sentence = [first[0].toUpperCase() + first.slice(1), ...rest].join(', ')
  return `Done. ${sentence}.`
}

export function isRunning(): boolean {
  return running
}

export function getLastRun(): SyncRunResult | null {
  return (getStore().get('lastRun') as SyncRunResult | null) ?? null
}

export async function runSync(onProgress?: (p: SyncProgress) => void): Promise<SyncRunResult> {
  if (running) throw new Error('A sync is already in progress.')
  running = true
  const startedAt = new Date().toISOString()
  const results: SyncCaseResult[] = []

  const report = (p: SyncProgress): void => {
    try {
      onProgress?.(p)
    } catch {}
  }

  try {
    return await calendarLock.runExclusive(async () => {
      if (!authStatus().signedIn) {
        throw new Error('Not signed in to Google. Please sign in first.')
      }

      const cases = getCases()
      const enabled = cases.filter((c) => c.enabled && c.caseNumber.trim())
      report({
        phase: 'start',
        message: `Starting sync for ${enabled.length} case(s)…`,
        total: enabled.length,
        current: 0
      })

      if (enabled.length === 0) {
        const finishedAt = new Date().toISOString()
        const empty: SyncRunResult = {
          startedAt,
          finishedAt,
          results: [],
          summary: { processed: 0, added: 0, moved: 0, recreated: 0, skipped: 0, failed: 0 }
        }
        getStore().set('lastRun', empty)
        report({ phase: 'done', message: 'No enabled cases to sync.' })
        return empty
      }

      const scraper = new ScraperSession()
      await scraper.init()

      let added = 0
      let moved = 0
      let recreated = 0
      let skipped = 0
      let failed = 0

      try {
        for (let i = 0; i < enabled.length; i++) {
          const c = enabled[i]
          report({
            phase: 'case',
            message: `Looking up ${c.caseNumber} (${c.district})…`,
            current: i + 1,
            total: enabled.length
          })

          let result: SyncCaseResult

          const lookup = await scraper.lookup(c.caseNumber.trim(), c.district.trim())
          if (!lookup.ok || !lookup.nextHearing) {
            failed++
            result = {
              caseId: c.id,
              caseNumber: c.caseNumber,
              ok: false,
              message: lookup.error || 'Lookup failed.'
            }
            updateCaseAfterSync(c.id, result, { needsAttention: true })
          } else {
            try {
              const res = await ensureHearingEvent({
                calendarId: getSettings().calendarId || 'primary',
                trackedEventId: c.trackedEventId,
                spec: c.event,
                hearingDate: lookup.nextHearing,
                stage: lookup.stage,
                judge: lookup.judge,
                trackStage: c.trackStage,
                trackJudges: c.trackJudges
              })
              switch (res.status) {
                case 'noop':
                  skipped++
                  break
                case 'moved':
                  moved++
                  break
                case 'recreated':
                  recreated++
                  break
                case 'created':
                  added++
                  break
              }
              result = {
                caseId: c.id,
                caseNumber: c.caseNumber,
                ok: true,
                nextHearing: lookup.nextHearing,
                message: res.message
              }
              updateCaseAfterSync(c.id, result, {
                needsAttention: false,
                trackedEventId: res.eventId,
                trackedHearingDate: res.hearingDate,
                event: res.spec
              })
            } catch (e) {
              failed++
              result = {
                caseId: c.id,
                caseNumber: c.caseNumber,
                ok: false,
                nextHearing: lookup.nextHearing,
                message: `Calendar error: ${(e as Error).message}`
              }
              updateCaseAfterSync(c.id, result, { needsAttention: true })
            }
          }

          results.push(result)
        }
      } finally {
        scraper.close()
      }

      const finishedAt = new Date().toISOString()
      const run: SyncRunResult = {
        startedAt,
        finishedAt,
        results,
        summary: { processed: enabled.length, added, moved, recreated, skipped, failed }
      }
      getStore().set('lastRun', run)
      setSettings({ lastRunDate: todayIso() })
      report({
        phase: 'done',
        message: summarize(run.summary)
      })
      return run
    })
  } finally {
    running = false
  }
}

function updateCaseAfterSync(
  caseId: string,
  result: SyncCaseResult,
  patch: Partial<CaseItem>
): void {
  const cases = getCases()
  const idx = cases.findIndex((c) => c.id === caseId)
  if (idx === -1) return
  cases[idx] = {
    ...cases[idx],
    ...patch,
    lastSyncedAt: new Date().toISOString(),
    lastKnownHearing: result.nextHearing ?? cases[idx].lastKnownHearing ?? null,
    lastStatus: result.message
  }
  setCases(cases)
}
