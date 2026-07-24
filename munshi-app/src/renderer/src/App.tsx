import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MunshiLogo } from '@/components/munshi-logo'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/theme-toggle'
import { LoginScreen } from '@/components/login-screen'
import { CasesView } from '@/components/cases-view'
import { ActivityView } from '@/components/activity-view'
import { SettingsView } from '@/components/settings-view'
import { AccountMenu } from '@/components/account-menu'
import type { AuthState } from '../../shared/types'

function App(): JSX.Element {
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.api.authStatus().then(setAuth)
    void window.api.getVersion().then(setVersion)
  }, [])

  useEffect(() => {
    return window.api.onAuthExpired(() => {
      setAuth({ signedIn: false, email: null })
      toast.error('Your Google sign-in has expired. Please sign in again.')
    })
  }, [])

  if (!auth) {
    return <div className="app-loading">Loading…</div>
  }

  if (!auth.signedIn) {
    return <LoginScreen onSignedIn={setAuth} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <div className="brand-mark app-brand-mark">
              <MunshiLogo className="app-brand-glyph" />
            </div>
            <div>
              <h1 className="app-title">Munshi</h1>
              <p className="app-tagline">Hearing dates, on your calendar automatically</p>
            </div>
          </div>
          <div className="app-header-actions">
            <ThemeToggle />
            <AccountMenu auth={auth} onSignedOut={setAuth} />
          </div>
        </div>
      </header>

      <main className="app-main">
        <Tabs defaultValue="cases" className="app-tabs">
          <TabsList>
            <TabsTrigger value="cases">Cases</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="cases">
            <CasesView />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityView />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsView version={version} onSignedOut={setAuth} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <Separator className="app-footer-rule" />
          <p className="app-footer-note">
            Munshi v{version} · District Judiciary Punjab · runs quietly in the background once a day
          </p>
          <p className="app-footer-links">
            <span>Built by Muhammad Talha</span>
            <span className="app-footer-dot">·</span>
            <a href="https://mtalhasajid.dev" target="_blank" rel="noreferrer">Portfolio</a>
            <span className="app-footer-dot">·</span>
            <a href="mailto:support@mtalhasajid.dev" target="_blank" rel="noreferrer">
              support@mtalhasajid.dev
            </a>
            <span className="app-footer-dot">·</span>
            <a href="https://github.com/mtalha1012/munshi" target="_blank" rel="noreferrer">GitHub</a>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
