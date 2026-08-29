import { createInMemoryRateLimiter } from '@/domain/rate-limit/limiter'

/**
 * Shared limiters for the guest-facing surface (docs/SECURITY.md §4).
 *
 * Limits are generous enough that a real household refreshing and correcting their
 * answers is never blocked, but low enough to make token guessing pointless — against
 * a 256-bit token, any rate at all is already hopeless; this mainly protects the
 * database from scanning traffic.
 */
export const invitationLookupLimiter = createInMemoryRateLimiter({
  limit: 30,
  windowMs: 60_000,
})

export const rsvpSubmissionLimiter = createInMemoryRateLimiter({
  limit: 20,
  windowMs: 60_000,
})

/**
 * Best-effort client address.
 *
 * Behind Caddy the real address arrives in X-Forwarded-For. Only the first entry is
 * used, since later entries are attacker-controllable.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip') ?? 'unknown'
}
