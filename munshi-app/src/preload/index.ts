import { contextBridge, ipcRenderer } from 'electron'
import type {
  AuthState,
  CaseItem,
  Settings,
  SyncRunResult,
  SyncProgress,
  MunshiApi,
  UpcomingEvent,
  LookupHearingResult,
  ProvisionResult
} from '../shared/types'

const api: MunshiApi = {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  authStatus: () => ipcRenderer.invoke('auth:status') as Promise<AuthState>,
  signIn: () => ipcRenderer.invoke('auth:signIn') as Promise<AuthState>,
  cancelSignIn: () => ipcRenderer.invoke('auth:cancelSignIn') as Promise<void>,
  signOut: () => ipcRenderer.invoke('auth:signOut') as Promise<AuthState>,

  listCases: () => ipcRenderer.invoke('cases:list') as Promise<CaseItem[]>,
  saveCase: (input) => ipcRenderer.invoke('cases:save', input) as Promise<CaseItem[]>,
  lookupHearing: (caseNumber, district) =>
    ipcRenderer.invoke('cases:lookupHearing', caseNumber, district) as Promise<LookupHearingResult>,
  provisionCase: (caseId) => ipcRenderer.invoke('cases:provision', caseId) as Promise<ProvisionResult>,
  listUpcomingEvents: () => ipcRenderer.invoke('calendar:listUpcoming') as Promise<UpcomingEvent[]>,
  deleteCase: (id) => ipcRenderer.invoke('cases:delete', id) as Promise<CaseItem[]>,

  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<Settings>,
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch) as Promise<Settings>,

  runNow: () => ipcRenderer.invoke('sync:runNow') as Promise<SyncRunResult>,
  getLastRun: () => ipcRenderer.invoke('sync:getLastRun') as Promise<SyncRunResult | null>,

  checkForUpdates: () => ipcRenderer.invoke('updates:check'),

  quit: () => ipcRenderer.invoke('app:quit') as Promise<void>,

  onSyncProgress: (cb: (p: SyncProgress) => void) => {
    const listener = (_e: unknown, p: SyncProgress): void => cb(p)
    ipcRenderer.on('sync:progress', listener)
    return () => ipcRenderer.removeListener('sync:progress', listener)
  },

  onAuthExpired: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('auth:expired', listener)
    return () => ipcRenderer.removeListener('auth:expired', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
