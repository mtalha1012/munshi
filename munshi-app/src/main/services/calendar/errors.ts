// Gone means 404/410; gaxios puts the status on .status, not .code.
export function isGoneError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { status?: unknown; code?: unknown; response?: { status?: unknown } }
  const raw = err.status ?? err.response?.status ?? err.code
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw
  return n === 404 || n === 410
}

// The Google session is dead (expired/revoked refresh token, or an
// unauthenticated 401) and the user must sign in again. Distinct from a 403,
// which means insufficient scope or a disabled API — a different problem.
export function isAuthError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as {
    status?: unknown
    message?: unknown
    response?: { status?: unknown; data?: { error?: unknown } }
  }
  const raw = err.status ?? err.response?.status
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw
  if (n === 401) return true

  const apiError = err.response?.data?.error
  if (apiError === 'invalid_grant' || apiError === 'invalid_token') return true

  const msg = typeof err.message === 'string' ? err.message.toLowerCase() : ''
  return (
    msg.includes('invalid_grant') ||
    msg.includes('invalid_token') ||
    msg.includes('token has been expired or revoked') ||
    msg.includes('no refresh token') ||
    msg.includes('no access, refresh token, api key')
  )
}
