// Google OAuth desktop-client credentials.
//
// Local dev/build: put MAIN_VITE_GOOGLE_CLIENT_ID / MAIN_VITE_GOOGLE_CLIENT_SECRET
// in .env (git-ignored). electron-vite injects them at build time.
// CI/shell builds may instead export MUNSHI_GOOGLE_CLIENT_ID / _SECRET.
export function getOAuthConfig(): { clientId: string; clientSecret: string } {
  return {
    clientId: import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID || process.env.MUNSHI_GOOGLE_CLIENT_ID || '',
    clientSecret:
      import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET || process.env.MUNSHI_GOOGLE_CLIENT_SECRET || ''
  }
}

export function isOAuthConfigured(): boolean {
  const { clientId, clientSecret } = getOAuthConfig()
  return !!clientId && !!clientSecret
}

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
  'profile'
]
