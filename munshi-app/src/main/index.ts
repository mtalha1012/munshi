import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  Menu,
  Tray,
  nativeImage
} from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import { getSettings } from './services/store'
import { applyLoginItem, startDailyScheduler } from './services/scheduler'
import { initUpdater, checkForUpdates, updaterEvents } from './services/updater'
import { authEvents, cancelSignIn } from './services/auth'
import type { SyncProgress } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
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
  console.log('[munshi] createWindow, rendererUrl=', rendererUrl)
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  // Force DevTools open in dev mode. Docked bottom so it's visible even if
  // detach fails silently on this platform.
  if (rendererUrl || !app.isPackaged) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.openDevTools({ mode: 'bottom' })
      console.log('[munshi] devtools requested')
    })
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.log('[munshi] renderer crashed:', details)
    })
    mainWindow.webContents.on(
      'console-message',
      (_e, level, message, line, sourceId) => {
        console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
      }
    )
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

function quitApp(): void {
  isQuiting = true
  app.quit()
}

function createTray(): void {
  // Closing the window only hides it (see the 'close' handler above) so the
  // daily scheduler keeps running. Without a tray icon the app would be
  // invisible-but-alive, with no way to reopen or quit it.
  const image = nativeImage
    .createFromPath(APP_ICON)
    .resize({ width: 16, height: 16 })
  tray = new Tray(image)
  tray.setToolTip('Munshi')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Munshi', click: () => showMainWindow() },
      { type: 'separator' },
      { label: 'Quit Munshi', click: () => quitApp() }
    ])
  )
  tray.on('double-click', () => showMainWindow())
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(() => {
    createWindow()
    createTray()

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
    ipcMain.handle('app:quit', () => quitApp())

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
  // Release the icon explicitly; otherwise Windows can leave a ghost in the
  // notification area until the user hovers over it.
  tray?.destroy()
  tray = null
})

app.on('window-all-closed', () => {})
