import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import { getSettings } from './services/store'
import { applyLoginItem, startDailyScheduler } from './services/scheduler'
import { initUpdater, checkForUpdates, updaterEvents } from './services/updater'
import { authEvents, cancelSignIn } from './services/auth'
import type { SyncProgress } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let isQuiting = false

const APP_ICON = join(__dirname, '../../resources/icon.png')

function startedHidden(): boolean {
  return process.argv.includes('--hidden')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 940,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    icon: APP_ICON,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!startedHidden()) mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault()
      // Abort a sign-in the user left mid-flow so it doesn't stay pending in the
      // tray and wedge the login screen when the window is shown again.
      cancelSignIn()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    mainWindow?.show()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(() => {
    createWindow()

    const broadcast = (p: SyncProgress): void => {
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('sync:progress', p)
      })
    }

    authEvents.on('expired', () => {
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('auth:expired')
      })
    })

    updaterEvents.on('update-downloaded', (version: string) => {
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('update:downloaded', version)
      })
    })

    registerIpc(broadcast)
    ipcMain.handle('app:quit', () => {
      isQuiting = true
      app.quit()
    })

    applyLoginItem(getSettings().runAtLogin)
    startDailyScheduler(broadcast)
    initUpdater()
    void checkForUpdates()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
      else showMainWindow()
    })
  })
}

app.on('before-quit', () => {
  isQuiting = true
})

app.on('window-all-closed', () => {})
