import { ipcMain, app } from 'electron'
import { randomUUID } from 'crypto'
import { getCases, setCases, getSettings, setSettings } from './services/store'
import { authStatus, signIn, signOut, cancelSignIn } from './services/auth'
import { runSync, getLastRun } from './services/sync'
import { applyLoginItem } from './services/scheduler'
import { checkForUpdates } from './services/updater'
import { ensureHearingEvent, listUpcoming, defaultSpec } from './services/calendar'
import { lookupOnce } from './services/scraper'
import { calendarLock } from './services/mutex'
import type { CaseItem, Settings, SyncProgress, SaveCaseInput } from '../shared/types'

// Re-read right before writing so a concurrent sync write isn't clobbered.
function patchCase(caseId: string, patch: Partial<CaseItem>): void {
  const cases = getCases()
  const idx = cases.findIndex((c) => c.id === caseId)
  if (idx === -1) return
  cases[idx] = { ...cases[idx], ...patch }
  setCases(cases)
}

export function registerIpc(broadcast: (p: SyncProgress) => void): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('auth:status', () => authStatus())
  ipcMain.handle('auth:signIn', () => signIn())
  ipcMain.handle('auth:cancelSignIn', () => cancelSignIn())
  ipcMain.handle('auth:signOut', () => signOut())

  ipcMain.handle('cases:list', () => getCases())

  ipcMain.handle('cases:save', (_e, input: SaveCaseInput) => {
    const cases = getCases()
    const name = input.name.trim() || input.caseNumber.trim()
    if (input.id) {
      const idx = cases.findIndex((c) => c.id === input.id)
      if (idx !== -1) {
        cases[idx] = {
          ...cases[idx],
          caseNumber: input.caseNumber.trim(),
          district: input.district.trim(),
          name,
          enabled: input.enabled ?? cases[idx].enabled,
          event: input.event,
          trackedEventId: input.trackedEventId ?? cases[idx].trackedEventId,
          trackStage: input.trackStage ?? cases[idx].trackStage,
          trackJudges: input.trackJudges ?? cases[idx].trackJudges
        }
        return setCases(cases)
      }
    }
    const item: CaseItem = {
      id: randomUUID(),
      caseNumber: input.caseNumber.trim(),
      district: input.district.trim(),
      name,
      enabled: input.enabled ?? true,
      event: input.event ?? defaultSpec(name),
      trackedEventId: input.trackedEventId ?? null,
      trackedHearingDate: null,
      lastKnownHearing: null,
      lastSyncedAt: null,
      lastStatus: null,
      needsAttention: true,
      trackStage: input.trackStage ?? false,
      trackJudges: input.trackJudges ?? false
    }
    return setCases([...cases, item])
  })

  ipcMain.handle('cases:lookupHearing', async (_e, caseNumber: string, district: string) => {
    try {
      const r = await lookupOnce(caseNumber, district)
      return { ok: r.ok, nextHearing: r.nextHearing, error: r.error }
    } catch (e) {
      return { ok: false, nextHearing: null, error: (e as Error).message }
    }
  })

  ipcMain.handle('cases:provision', async (_e, caseId: string) => {
    return calendarLock.runExclusive(async () => {
      const cases = getCases()
      const idx = cases.findIndex((c) => c.id === caseId)
      if (idx === -1) return { ok: false, message: 'Case not found.' }
      const c = cases[idx]

      let lookup
      try {
        lookup = await lookupOnce(c.caseNumber, c.district)
      } catch (e) {
        const message = (e as Error).message
        patchCase(caseId, { needsAttention: true, lastStatus: message })
        return { ok: false, message }
      }
      if (!lookup.ok || !lookup.nextHearing) {
        patchCase(caseId, { needsAttention: true, lastStatus: lookup.error || 'Lookup failed.' })
        return {
          ok: false,
          message: lookup.error || 'Could not find this case on the court website.'
        }
      }

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
        patchCase(caseId, {
          event: res.spec,
          trackedEventId: res.eventId,
          trackedHearingDate: res.hearingDate,
          lastKnownHearing: lookup.nextHearing,
          lastSyncedAt: new Date().toISOString(),
          lastStatus: res.message,
          needsAttention: false
        })
        return { ok: true, message: res.message, nextHearing: lookup.nextHearing }
      } catch (e) {
        patchCase(caseId, { needsAttention: true, lastStatus: (e as Error).message })
        return { ok: false, message: `Calendar error: ${(e as Error).message}` }
      }
    })
  })

  ipcMain.handle('calendar:listUpcoming', async () => {
    return listUpcoming(getSettings().calendarId || 'primary')
  })

  ipcMain.handle('cases:delete', (_e, id: string) => {
    return setCases(getCases().filter((c) => c.id !== id))
  })

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    const before = getSettings()
    const after = setSettings(patch)
    if (patch.runAtLogin !== undefined && patch.runAtLogin !== before.runAtLogin) {
      applyLoginItem(after.runAtLogin)
    }
    return after
  })

  ipcMain.handle('sync:runNow', () => runSync(broadcast))
  ipcMain.handle('sync:getLastRun', () => getLastRun())

  ipcMain.handle('updates:check', () => checkForUpdates())
}
