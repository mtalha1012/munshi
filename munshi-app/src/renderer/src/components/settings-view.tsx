import { useEffect, useState } from 'react'
import { RefreshCw, Power, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AuthState, Settings } from '../../../shared/types'

export function SettingsView({
  version,
  onSignedOut
}: {
  version: string
  onSignedOut: (a: AuthState) => void
}): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    void window.api.getSettings().then(setSettings)
  }, [])

  const patch = async (p: Partial<Settings>): Promise<void> => {
    const next = await window.api.setSettings(p)
    setSettings(next)
  }

  const checkUpdates = async (): Promise<void> => {
    const res = await window.api.checkForUpdates()
    toast(res.message)
  }

  const signOut = async (): Promise<void> => {
    const state = await window.api.signOut()
    onSignedOut(state)
  }

  const quit = async (): Promise<void> => {
    await window.api.quit()
  }

  if (!settings) return <div className="settings-loading">Loading…</div>

  return (
    <div className="settings-view">
      <div>
        <h2 className="settings-heading">Settings</h2>
        <p className="settings-subheading">Control how Munshi runs.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="settings-card-title">Background sync</CardTitle>
          <CardDescription>Munshi updates your calendar once a day, quietly.</CardDescription>
        </CardHeader>
        <CardContent className="settings-card-body">
          <div className="settings-row">
            <div className="settings-row-label">
              <Label htmlFor="runAtLogin">Start automatically at login</Label>
              <p className="settings-help">
                Recommended, so the daily update runs without you opening the app.
              </p>
            </div>
            <Switch
              id="runAtLogin"
              checked={settings.runAtLogin}
              onCheckedChange={(v) => patch({ runAtLogin: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="settings-card-title">Calendar</CardTitle>
          <CardDescription>Which Google Calendar Munshi writes to.</CardDescription>
        </CardHeader>
        <CardContent className="settings-card-body-tight">
          <Label htmlFor="calendarId">Calendar ID</Label>
          <Input
            id="calendarId"
            value={settings.calendarId}
            onChange={(e) => setSettings({ ...settings, calendarId: e.target.value })}
            onBlur={() => patch({ calendarId: settings.calendarId.trim() || 'primary' })}
          />
          <p className="settings-help">
            Leave as <span className="settings-help-strong">primary</span> for your main calendar, or
            paste a specific Calendar ID.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="settings-card-title">App</CardTitle>
          <CardDescription>Version {version || '—'}</CardDescription>
        </CardHeader>
        <CardContent className="settings-actions">
          <Button variant="outline" onClick={checkUpdates}>
            <RefreshCw className="icon-leading" />
            Check for updates
          </Button>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="icon-leading" />
            Sign out
          </Button>
          <Button variant="destructive" onClick={quit}>
            <Power className="icon-leading" />
            Quit Munshi
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
