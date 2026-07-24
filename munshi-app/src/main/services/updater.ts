import { autoUpdater } from 'electron-updater'
import { app } from 'electron'

let wired = false

// Updates come from the publish URL in electron-builder.yml.
export function initUpdater(): void {
  if (wired) return
  wired = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-downloaded', () => {})
  autoUpdater.on('error', () => {})
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
