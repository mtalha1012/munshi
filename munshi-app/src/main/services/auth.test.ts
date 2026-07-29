import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// signIn() spins up a real loopback http server and would otherwise open a
// browser and construct a real Google client — stub the outside world so the
// test exercises only the sign-in lifecycle (start / cancel / supersede).
// vi.mock factories are hoisted above the file, so shared spies must live in
// vi.hoisted() (same pattern as ipc.test.ts).
const h = vi.hoisted(() => ({
  store: { get: vi.fn(() => null), set: vi.fn() },
  openExternal: vi.fn((_url: string) => Promise.resolve())
}))

vi.mock('electron', () => ({ shell: { openExternal: h.openExternal } }))
vi.mock('./store', () => ({ getStore: () => h.store }))
vi.mock('../oauth-config', () => ({
  getOAuthConfig: () => ({ clientId: 'test-id', clientSecret: 'test-secret' }),
  isOAuthConfigured: () => true,
  GOOGLE_SCOPES: ['openid', 'email']
}))
vi.mock('google-auth-library', () => ({ CodeChallengeMethod: { S256: 'S256' } }))
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        generateAuthUrl(): string {
          return 'https://accounts.google.com/o/oauth2/v2/auth?mock=1'
        }
      }
    }
  }
}))

import { signIn, cancelSignIn, SignInCancelledError } from './auth'

const waitFor = async (cond: () => boolean, ms = 1000): Promise<void> => {
  const start = Date.now()
  while (!cond() && Date.now() - start < ms) {
    await new Promise((r) => setTimeout(r, 5))
  }
}

describe('signIn cancellation lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cancelSignIn() // clear anything a prior test left in flight
  })
  afterEach(() => {
    cancelSignIn() // never leak a listening server / 5-min timer between tests
  })

  it('cancelSignIn() settles a pending sign-in with SignInCancelledError', async () => {
    const outcome = signIn()
      .then(() => 'resolved')
      .catch((e) => e)

    cancelSignIn()

    expect(await outcome).toBeInstanceOf(SignInCancelledError)
  })

  it('a fresh signIn() supersedes and cancels the previous attempt', async () => {
    const firstOutcome = signIn()
      .then(() => 'resolved')
      .catch((e) => e)

    // Starting a new attempt must tear down the abandoned first one.
    const secondOutcome = signIn()
      .then(() => 'resolved')
      .catch((e) => e)

    expect(await firstOutcome).toBeInstanceOf(SignInCancelledError)

    cancelSignIn()
    expect(await secondOutcome).toBeInstanceOf(SignInCancelledError)
  })

  it('cancelSignIn() with nothing in flight is a harmless no-op', () => {
    expect(() => cancelSignIn()).not.toThrow()
  })

  it('starting a sign-in opens the system browser to Google', async () => {
    const outcome = signIn().catch((e) => e)

    await waitFor(() => h.openExternal.mock.calls.length > 0)

    expect(h.openExternal).toHaveBeenCalledTimes(1)
    expect(String(h.openExternal.mock.calls[0][0])).toContain('accounts.google.com')

    cancelSignIn()
    await outcome
  })
})
