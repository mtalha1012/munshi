import { describe, it, expect, vi } from 'vitest'

// A self-contained fake of electron-updater's autoUpdater (its on/emit surface
// plus the flags/methods updater.ts touches). Built inside vi.hoisted so the
// mock factory below can reference it.
const h = vi.hoisted(() => {
  const listeners: Record<string, ((...a: unknown[]) => void)[]> = {}
  const au = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn(() => Promise.resolve()),
    quitAndInstall: vi.fn(),
    on(event: string, cb: (...a: unknown[]) => void) {
      ;(listeners[event] ||= []).push(cb)
      return au
    },
    emit(event: string, ...args: unknown[]): void {
      ;(listeners[event] || []).forEach((cb) => cb(...args))
    }
  }
  return { au }
})

vi.mock('electron-updater', () => ({ autoUpdater: h.au }))
vi.mock('electron', () => ({ app: { isPackaged: true } }))

import { initUpdater, quitAndInstallUpdate, updaterEvents } from './updater'

describe('updater', () => {
  it('enables auto-download and re-emits update-downloaded with the version', () => {
    initUpdater()
    expect(h.au.autoDownload).toBe(true)
    expect(h.au.autoInstallOnAppQuit).toBe(true)

    const seen: string[] = []
    updaterEvents.on('update-downloaded', (v: string) => seen.push(v))

    h.au.emit('update-downloaded', { version: '1.1.0' })
    expect(seen).toEqual(['1.1.0'])
  })

  it('quitAndInstallUpdate installs silently and relaunches', () => {
    quitAndInstallUpdate()
    expect(h.au.quitAndInstall).toHaveBeenCalledWith(true, true)
  })
})
