/**
 * Rate limiting.
 *
 * Behind an interface because the in-process implementation is only correct while one
 * wedding runs in one container (consistent with ADR-006). Introducing replicas would
 * mean swapping in a shared store, and only this file should have to change.
 */
export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export interface RateLimiter {
  check(key: string): RateLimitResult
}

export type RateLimitOptions = {
  /** Maximum attempts permitted within the window. */
  limit: number
  windowMs: number
  /** Injectable for deterministic tests. */
  now?: () => number
}

type Bucket = { count: number; resetAt: number }

/**
 * Fixed-window counter held in memory.
 *
 * Chosen over a sliding log because the traffic being limited (invitation lookups,
 * RSVP posts, logins) is low-volume, and the memory cost of per-key timestamp lists
 * would not buy anything at this scale.
 */
export function createInMemoryRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: RateLimitOptions): RateLimiter {
  const buckets = new Map<string, Bucket>()

  return {
    check(key: string): RateLimitResult {
      const timestamp = now()
      const bucket = buckets.get(key)

      if (!bucket || timestamp >= bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: timestamp + windowMs })

        // Opportunistic sweep: without it, a scanner hitting many distinct keys would
        // grow the map without bound.
        if (buckets.size > 10_000) {
          for (const [existingKey, existing] of buckets) {
            if (timestamp >= existing.resetAt) buckets.delete(existingKey)
          }
        }

        return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
      }

      bucket.count += 1
      const retryAfterSeconds = Math.ceil((bucket.resetAt - timestamp) / 1000)

      if (bucket.count > limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds }
      }

      return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds }
    },
  }
}
