import { createError, getRequestIP, type H3Event } from 'h3'
import { requireAuthenticatedUser } from './password-auth'

interface RateBucket {
  count: number
  resetAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __aiAccessRateBuckets: Map<string, RateBucket> | undefined
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

function pruneExpiredBuckets(buckets: Map<string, RateBucket>, now: number): void {
  for (const [key, bucket] of buckets.entries()) {
    if (now >= bucket.resetAt) {
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

export function protectAiUsageEndpoint(event: H3Event): void {
  requireAuthenticatedUser(event)
  enforceRateLimit(event)
}
