import { autoUpdater } from 'electron-updater'
import { app } from 'electron'
import { EventEmitter } from 'events'

// Emits 'update-downloaded' (with the new version string) once an update is
// staged and ready, so the UI can offer a "restart & update" prompt.
export const updaterEvents = new EventEmitter()

let wired = false

// Updates come from the publish URL in electron-builder.yml.
export function initUpdater(): void {
  if (wired) return
  wired = true
  autoUpdater.autoDownload = true
  // Fallback: this app hides to the tray instead of quitting, so a real quit is
  // rare. The in-app prompt (via 'update-downloaded' below) is the primary path;
  // this just ensures a staged update still applies if the app ever fully quits.
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-downloaded', (info) => {
    updaterEvents.emit('update-downloaded', info?.version ?? '')
  })
  autoUpdater.on('error', () => {})
}

// Quit, install the staged update, and relaunch. Only meaningful after an
// 'update-downloaded' event. Silent install (no NSIS wizard) + auto-relaunch.
export function quitAndInstallUpdate(): void {
  autoUpdater.quitAndInstall(true, true)
}

export async function checkForUpdates(): Promise<{ checking: boolean; message: string }> {
  if (!app.isPackaged) {
    return { checking: false, message: 'Updates are only checked in the installed app.' }
  }
  try {
    initUpdater()
    await autoUpdater.checkForUpdates()
    return { checking: true, message: 'Checking for updates…' }
  } catch (e) {
    return { checking: false, message: `Update check failed: ${(e as Error).message}` }
  }
}
