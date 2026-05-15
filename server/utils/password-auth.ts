import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createError, deleteCookie, getCookie, setCookie, type H3Event } from 'h3'

const AUTH_COOKIE_NAME = 'knowledge_merges_auth'
const DEFAULT_SESSION_TTL_HOURS = 24

interface AuthSessionRecord {
  username: string
  expiresAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __knowledgeMergesAuthSessions: Map<string, AuthSessionRecord> | undefined
}

function getConfiguredUsername(): string {
  return process.env.APP_AUTH_USERNAME?.trim() ?? ''
}

function getConfiguredPassword(): string {
  return process.env.APP_AUTH_PASSWORD ?? ''
}

function getSessionTtlMs(): number {
  const raw = process.env.AUTH_SESSION_TTL_HOURS?.trim()
  if (!raw) {
    return DEFAULT_SESSION_TTL_HOURS * 60 * 60 * 1000
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SESSION_TTL_HOURS * 60 * 60 * 1000
  }

  return parsed * 60 * 60 * 1000
}

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function getAuthSessions(): Map<string, AuthSessionRecord> {
  if (!globalThis.__knowledgeMergesAuthSessions) {
    globalThis.__knowledgeMergesAuthSessions = new Map<string, AuthSessionRecord>()
  }

  return globalThis.__knowledgeMergesAuthSessions
}

function pruneExpiredSessions(sessions: Map<string, AuthSessionRecord>, now: number): void {
  for (const [token, session] of sessions.entries()) {
    if (now >= session.expiresAt) {
      sessions.delete(token)
    }
  }
}

export function isPasswordAuthConfigured(): boolean {
  return Boolean(getConfiguredUsername() && getConfiguredPassword())
}

export function ensurePasswordAuthConfigured(): void {
  if (!isPasswordAuthConfigured()) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server misconfigured: APP_AUTH_USERNAME and APP_AUTH_PASSWORD must be set.'
    })
  }
}

function setAuthCookie(event: H3Event, token: string, expiresAt: number): void {
  const maxAgeSeconds = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000))

  setCookie(event, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
    maxAge: maxAgeSeconds
  })
}

function createSession(event: H3Event, username: string): void {
  const sessions = getAuthSessions()
  const now = Date.now()
  const ttlMs = getSessionTtlMs()
  const token = randomBytes(32).toString('hex')
  const expiresAt = now + ttlMs

  pruneExpiredSessions(sessions, now)
  sessions.set(token, {
    username,
    expiresAt
  })

  setAuthCookie(event, token, expiresAt)
}

export function getAuthenticatedUsername(event: H3Event): string | null {
  const token = getCookie(event, AUTH_COOKIE_NAME)
  if (!token) {
    return null
  }

  const sessions = getAuthSessions()
  const now = Date.now()
  pruneExpiredSessions(sessions, now)

  const session = sessions.get(token)
  if (!session) {
    return null
  }

  if (now >= session.expiresAt) {
    sessions.delete(token)
    return null
  }

  const refreshedExpiry = now + getSessionTtlMs()
  session.expiresAt = refreshedExpiry
  setAuthCookie(event, token, refreshedExpiry)
  return session.username
}

export function requireAuthenticatedUser(event: H3Event): string {
  ensurePasswordAuthConfigured()
  const username = getAuthenticatedUsername(event)

  if (!username) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: login required.'
    })
  }

  return username
}

export function signInWithPassword(event: H3Event, input: { username: string; password: string }): string {
  ensurePasswordAuthConfigured()
  const configuredUsername = getConfiguredUsername()
  const configuredPassword = getConfiguredPassword()
  const providedUsername = input.username.trim()

  if (
    !providedUsername ||
    !input.password ||
    !secureEquals(configuredUsername, providedUsername) ||
    !secureEquals(configuredPassword, input.password)
  ) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid username or password.'
    })
  }

  createSession(event, configuredUsername)
  return configuredUsername
}

export function signOut(event: H3Event): void {
  const token = getCookie(event, AUTH_COOKIE_NAME)
  if (token) {
    const sessions = getAuthSessions()
    sessions.delete(token)
  }

  deleteCookie(event, AUTH_COOKIE_NAME, {
    path: '/'
  })
}
