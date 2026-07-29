import http from 'http'
import { URL } from 'url'
import { EventEmitter } from 'events'
import { randomBytes, createHash } from 'crypto'
import { shell } from 'electron'
import { google } from 'googleapis'
import { CodeChallengeMethod } from 'google-auth-library'
import type { OAuth2Client } from 'google-auth-library'
import { getStore } from './store'
import { getOAuthConfig, isOAuthConfigured, GOOGLE_SCOPES } from '../oauth-config'
import type { AuthState } from '../../shared/types'

// Emits 'expired' when a stored session is found dead mid-request and cleared,
// so the main process can tell the renderer to prompt a fresh sign-in.
export const authEvents = new EventEmitter()

// Thrown by calendar calls when the Google session is expired/revoked. Carries a
// message safe to show the user, unlike the raw 'invalid_grant'.
export class AuthExpiredError extends Error {
  constructor() {
    super('Your Google sign-in has expired. Please sign in again.')
    this.name = 'AuthExpiredError'
  }
}

// Clear the dead session and notify listeners. Idempotent.
export function handleAuthExpiry(): void {
  getStore().set('googleTokens', null)
  getStore().set('googleEmail', null)
  authEvents.emit('expired')
}

// Thrown to settle a sign-in that was aborted rather than failed — the user
// cancelled it, closed the window, or started a newer attempt. The UI treats
// this as a no-op (no error toast), unlike a real sign-in failure.
export class SignInCancelledError extends Error {
  constructor() {
    super('SIGN_IN_CANCELLED')
    this.name = 'SignInCancelledError'
  }
}

// Teardown for the sign-in currently in flight, if any. A fresh signIn(), an
// explicit cancelSignIn(), or the window closing to tray calls this to close the
// abandoned loopback server and settle its pending promise. Without it, closing
// the OAuth browser tab (which sends nothing to the server) left the promise
// hanging for the full 5-minute timeout, wedging the UI on a disabled
// "Opening Google…" button that survived closing and relaunching the app.
let cancelActiveSignIn: (() => void) | null = null

export function cancelSignIn(): void {
  const cancel = cancelActiveSignIn
  cancelActiveSignIn = null
  cancel?.()
}

function base64url(b: Buffer): string {
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function makePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

function storedTokens(): Record<string, unknown> | null {
  return (getStore().get('googleTokens') as Record<string, unknown> | null) ?? null
}

export function authStatus(): AuthState {
  const tokens = storedTokens()
  const email = (getStore().get('googleEmail') as string | null) ?? null
  return { signedIn: !!tokens, email }
}

function createOAuthClient(redirectUri?: string): OAuth2Client {
  const { clientId, clientSecret } = getOAuthConfig()
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export async function getAuthedClient(): Promise<OAuth2Client> {
  const tokens = storedTokens()
  if (!tokens) throw new Error('Not signed in to Google.')
  const client = createOAuthClient()
  client.setCredentials(tokens)
  client.on('tokens', (t) => {
    const merged = { ...storedTokens(), ...t }
    getStore().set('googleTokens', merged)
  })
  return client
}

export async function signIn(): Promise<AuthState> {
  if (!isOAuthConfigured()) {
    throw new Error(
      'Google sign-in is not configured yet. The app developer needs to add a Google OAuth client (see README > Google setup).'
    )
  }

  // Tear down any previous attempt the user abandoned (e.g. closed the browser
  // tab): its loopback server is still open and its promise still pending. This
  // attempt becomes the only one in flight.
  cancelSignIn()

  return new Promise<AuthState>((resolve, reject) => {
    const { verifier, challenge } = makePkce()
    const expectedState = base64url(randomBytes(16))
    let settled = false
    let timeout: NodeJS.Timeout
    let redirectUri = ''
    let server: http.Server

    // Settle exactly once, and always release the loopback server, the timeout,
    // and this attempt's cancel registration.
    const finish = (action: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try {
        server.close()
      } catch {}
      cancelActiveSignIn = null
      action()
    }
    const cancel = (): void => finish(() => reject(new SignInCancelledError()))
    cancelActiveSignIn = cancel

    server = http.createServer(async (req, res) => {
      try {
        if (!req.url) return
        const url = new URL(req.url, 'http://127.0.0.1')
        if (url.pathname !== '/') {
          res.statusCode = 404
          res.end()
          return
        }
        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')
        if (returnedState !== expectedState) {
          res.statusCode = 400
          res.end('Invalid state')
          finish(() =>
            reject(new Error('Sign-in failed a security check (state mismatch). Please try again.'))
          )
          return
        }
        const err = url.searchParams.get('error')
        res.setHeader('Content-Type', 'text/html')
        res.end(
          '<html><body style="font-family:sans-serif;padding:40px;text-align:center">' +
            '<h2>Munshi</h2><p>You can close this tab and return to the app.</p></body></html>'
        )
        if (err || !code) {
          finish(() => reject(new Error(err || 'Sign-in was cancelled.')))
          return
        }
        const client = createOAuthClient(redirectUri)
        const { tokens } = await client.getToken({ code, codeVerifier: verifier })
        getStore().set('googleTokens', tokens)
        client.setCredentials(tokens)
        try {
          const oauth2 = google.oauth2({ version: 'v2', auth: client })
          const me = await oauth2.userinfo.get()
          if (me.data.email) getStore().set('googleEmail', me.data.email)
        } catch {}
        finish(() => resolve(authStatus()))
      } catch (e) {
        finish(() => reject(e as Error))
      }
    })

    server.on('error', (e) => finish(() => reject(e)))
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      redirectUri = `http://127.0.0.1:${port}`
      const client = createOAuthClient(redirectUri)
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: GOOGLE_SCOPES,
        code_challenge_method: CodeChallengeMethod.S256,
        code_challenge: challenge,
        state: expectedState
      })
      shell.openExternal(authUrl)
    })

    timeout = setTimeout(
      () => finish(() => reject(new Error('Sign-in timed out. Please try again.'))),
      5 * 60 * 1000
    )
  })
}

export function signOut(): AuthState {
  getStore().set('googleTokens', null)
  getStore().set('googleEmail', null)
  return authStatus()
}
