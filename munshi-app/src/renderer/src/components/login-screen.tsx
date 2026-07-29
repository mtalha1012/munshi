import { useState } from 'react'
import { LogIn, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/theme-toggle'
import { MunshiLogo } from '@/components/munshi-logo'
import type { AuthState } from '../../../shared/types'

export function LoginScreen({ onSignedIn }: { onSignedIn: (a: AuthState) => void }): JSX.Element {
  const [busy, setBusy] = useState(false)

  const signIn = async (): Promise<void> => {
    setBusy(true)
    try {
      const state = await window.api.signIn()
      if (state.signedIn) {
        toast.success('Signed in', { description: state.email || undefined })
        onSignedIn(state)
      }
    } catch (e) {
      // A sign-in the user cancelled (or one superseded by a newer attempt or by
      // closing the window) isn't a failure — just reset without an error toast.
      if (!((e as Error).message || '').includes('SIGN_IN_CANCELLED')) {
        toast.error('Could not sign in', { description: (e as Error).message })
      }
    } finally {
      setBusy(false)
    }
  }

  const cancel = (): void => {
    void window.api.cancelSignIn()
  }

  return (
    <div className="login-screen">
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>

      <Card className="login-card">
        <CardHeader className="login-card-header">
          <div className="brand-mark login-brand-mark">
            <MunshiLogo className="login-brand-glyph" />
          </div>
          <CardTitle>Munshi</CardTitle>
          <CardDescription>Hearing dates, on your calendar.</CardDescription>
        </CardHeader>
        <CardContent className="login-card-body">
          <Button className="login-submit" size="lg" onClick={signIn} disabled={busy}>
            {busy ? <Loader2 className="icon-leading is-spinning" /> : <LogIn className="icon-leading" />}
            {busy ? 'Opening Google…' : 'Sign in with Google'}
          </Button>

          {busy ? (
            <Button variant="ghost" size="sm" className="login-cancel" onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <p className="login-hint">Opens your browser to approve access.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
