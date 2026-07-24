import { app } from 'electron'
import { getSettings } from './store'
import { authStatus } from './auth'
import { runSync, isRunning } from './sync'
import type { SyncProgress } from '../../shared/types'

const CHECK_INTERVAL_MS = 30 * 60 * 1000
const STARTUP_DELAY_MS = 60 * 1000

let interval: NodeJS.Timeout | null = null

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function applyLoginItem(runAtLogin: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: runAtLogin,
    args: ['--hidden']
  })
}

async function maybeRun(broadcast: (p: SyncProgress) => void): Promise<void> {
  try {
    if (isRunning()) return
    const settings = getSettings()
    if (settings.lastRunDate === todayIso()) return
    if (!authStatus().signedIn) return
    await runSync(broadcast)
  } catch {}
}

export function startDailyScheduler(broadcast: (p: SyncProgress) => void): void {
  setTimeout(() => void maybeRun(broadcast), STARTUP_DELAY_MS)
  if (interval) clearInterval(interval)
  interval = setInterval(() => void maybeRun(broadcast), CHECK_INTERVAL_MS)
}

export function stopScheduler(): void {
  if (interval) clearInterval(interval)
  interval = null
}
