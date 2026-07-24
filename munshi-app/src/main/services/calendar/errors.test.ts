import { describe, it, expect } from 'vitest'
import { GaxiosError } from 'gaxios'
import { isGoneError, isAuthError } from './errors'

function realGaxiosError(status: number): GaxiosError {
  return new GaxiosError('Request failed with status code ' + status, {}, {
    status,
    data: {},
    config: {},
    headers: {},
    statusText: 'N/A'
  } as never)
}

describe('isGoneError', () => {
  it('a real GaxiosError with status 404 is gone (regression test for this bug)', () => {
    expect(isGoneError(realGaxiosError(404))).toBe(true)
  })
  it('a real GaxiosError with status 410 is gone', () => {
    expect(isGoneError(realGaxiosError(410))).toBe(true)
  })
  it('a real GaxiosError with status 500 is NOT gone', () => {
    expect(isGoneError(realGaxiosError(500))).toBe(false)
  })
  it('a real GaxiosError with status 401 is NOT gone', () => {
    expect(isGoneError(realGaxiosError(401))).toBe(false)
  })
  it('a real GaxiosError with status 429 is NOT gone', () => {
    expect(isGoneError(realGaxiosError(429))).toBe(false)
  })
  it('a Node system error (ECONNRESET) is NOT gone', () => {
    expect(isGoneError({ code: 'ECONNRESET' })).toBe(false)
  })
  it('a bare response.status shape of 404 is gone', () => {
    expect(isGoneError({ response: { status: 404 } })).toBe(true)
  })
  it('a legacy numeric .code of 404 is gone', () => {
    expect(isGoneError({ code: 404 })).toBe(true)
  })
  it('null is NOT gone', () => {
    expect(isGoneError(null)).toBe(false)
  })
  it('undefined is NOT gone', () => {
    expect(isGoneError(undefined)).toBe(false)
  })
  it('a string is NOT gone', () => {
    expect(isGoneError('a string')).toBe(false)
  })
  it('an empty object is NOT gone', () => {
    expect(isGoneError({})).toBe(false)
  })
})

function invalidGrantError(): GaxiosError {
  // Shape observed live: token refresh fails with 400 + { error: 'invalid_grant' }.
  return new GaxiosError('invalid_grant', {}, {
    status: 400,
    data: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' },
    config: {},
    headers: {},
    statusText: 'Bad Request'
  } as never)
}

describe('isAuthError', () => {
  it('the real invalid_grant refresh failure is an auth error (regression for this bug)', () => {
    expect(isAuthError(invalidGrantError())).toBe(true)
  })
  it('a 401 GaxiosError is an auth error', () => {
    const e = new GaxiosError('Unauthorized', {}, {
      status: 401,
      data: {},
      config: {},
      headers: {},
      statusText: 'Unauthorized'
    } as never)
    expect(isAuthError(e)).toBe(true)
  })
  it('a bare invalid_grant message is an auth error', () => {
    expect(isAuthError({ message: 'invalid_grant' })).toBe(true)
  })
  it('response.data.error invalid_token is an auth error', () => {
    expect(isAuthError({ response: { status: 400, data: { error: 'invalid_token' } } })).toBe(true)
  })
  it('a 403 (insufficient scope / API disabled) is NOT an auth error', () => {
    expect(isAuthError({ status: 403, response: { data: { error: 'PERMISSION_DENIED' } } })).toBe(
      false
    )
  })
  it('a 404 gone error is NOT an auth error', () => {
    expect(isAuthError({ status: 404 })).toBe(false)
  })
  it('a 500 is NOT an auth error', () => {
    expect(isAuthError({ status: 500 })).toBe(false)
  })
  it('a network error (ECONNRESET) is NOT an auth error', () => {
    expect(isAuthError({ code: 'ECONNRESET', message: 'socket hang up' })).toBe(false)
  })
  it('null / undefined / string are NOT auth errors', () => {
    expect(isAuthError(null)).toBe(false)
    expect(isAuthError(undefined)).toBe(false)
    expect(isAuthError('invalid_grant')).toBe(false)
  })
})
