import { createHash } from 'node:crypto'
import { createError, getRequestIP, type H3Event } from 'h3'
import { requireAuthenticatedUser } from './password-auth'

interface RateBucket {
  count: number
  resetAt: number
}
interface ReplayBucket {
  lastSeenAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __aiAccessRateBuckets: Map<string, RateBucket> | undefined
  // eslint-disable-next-line no-var
  var __aiAccessReplayBuckets: Map<string, ReplayBucket> | undefined
}


function getRateLimitPerMinute(): number {
  const raw = process.env.AI_MAX_REQUESTS_PER_MINUTE?.trim()
  if (!raw) {
    return 20
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    return 20
  }

  return Math.max(0, Math.floor(parsed))
}

function getRateLimitWindowMs(): number {
  const raw = process.env.AI_RATE_LIMIT_WINDOW_MS?.trim()
  if (!raw) {
    return 60_000
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 60_000
  }

  return parsed
}

function getRateBuckets(): Map<string, RateBucket> {
  if (!globalThis.__aiAccessRateBuckets) {
    globalThis.__aiAccessRateBuckets = new Map<string, RateBucket>()
  }

  return globalThis.__aiAccessRateBuckets
}

function getReplayProtectionWindowMs(): number {
  const raw = process.env.AI_REPLAY_PROTECTION_WINDOW_MS?.trim()
  if (!raw) {
    return 15_000
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 15_000
  }

  return parsed
}

function getReplayBuckets(): Map<string, ReplayBucket> {
  if (!globalThis.__aiAccessReplayBuckets) {
    globalThis.__aiAccessReplayBuckets = new Map<string, ReplayBucket>()
  }

  return globalThis.__aiAccessReplayBuckets
}
function pruneExpiredBuckets(buckets: Map<string, RateBucket>, now: number): void {
  for (const [key, bucket] of buckets.entries()) {
    if (now >= bucket.resetAt) {
      buckets.delete(key)
    }
  }
}

function pruneExpiredReplayBuckets(
  buckets: Map<string, ReplayBucket>,
  now: number,
  replayWindowMs: number
): void {
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastSeenAt >= replayWindowMs) {
      buckets.delete(key)
    }
  }
}
function enforceRateLimit(event: H3Event): void {
  const limit = getRateLimitPerMinute()
  if (limit <= 0) {
    return
  }

  const windowMs = getRateLimitWindowMs()
  const now = Date.now()
  const buckets = getRateBuckets()
  pruneExpiredBuckets(buckets, now)

  const requestIp = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const bucket = buckets.get(requestIp)

  if (!bucket) {
    buckets.set(requestIp, {
      count: 1,
      resetAt: now + windowMs
    })
    return
  }

  if (now >= bucket.resetAt) {
    bucket.count = 1
    bucket.resetAt = now + windowMs
    return
  }

  if (bucket.count >= limit) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many AI requests. Please retry shortly.'
    })
  }

  bucket.count += 1
}

function buildReplayFingerprint(scope: string, fingerprint: string): string {
  return createHash('sha256').update(`${scope}\n${fingerprint}`).digest('hex')
}

function enforceReplayProtection(input: {
  username: string
  scope: string
  fingerprint: string
}): void {
  const replayWindowMs = getReplayProtectionWindowMs()
  const now = Date.now()
  const buckets = getReplayBuckets()
  pruneExpiredReplayBuckets(buckets, now, replayWindowMs)

  const replayFingerprint = buildReplayFingerprint(input.scope, input.fingerprint)
  const bucketKey = `${input.username}:${replayFingerprint}`
  const bucket = buckets.get(bucketKey)

  if (bucket && now - bucket.lastSeenAt < replayWindowMs) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'Duplicate request blocked to prevent accidental repeated AI token usage. Please wait briefly and retry if needed.'
    })
  }

  buckets.set(bucketKey, {
    lastSeenAt: now
  })
}

export function requireAuthenticatedWriteEndpoint(event: H3Event): string {
  return requireAuthenticatedUser(event)
}

export function protectAiUsageForAuthenticatedUser(
  event: H3Event,
  username: string,
  input?: { scope: string; fingerprint: string }
): void {
  enforceRateLimit(event)
  if (input) {
    enforceReplayProtection({
      username,
      scope: input.scope,
      fingerprint: input.fingerprint
    })
  }
}
