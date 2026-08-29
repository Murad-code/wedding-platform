import { createInMemoryRateLimiter } from '@/domain/rate-limit/limiter'

/**
 * Rate limiting for the guest-facing surface (docs/SECURITY.md §4).
 *
 * **Why these are not simple per-IP limits on every request.** Guests at a wedding are
 * overwhelmingly behind one NAT: the venue's wifi, or a mobile carrier's. Throttling all
 * invitation lookups per IP would lock out an entire room of legitimate guests the moment
 * the link was shared — a self-inflicted outage during the event itself.
 *
 * What actually needs throttling is *enumeration*, and an attacker guessing tokens
 * produces a stream of **failed** lookups. So:
 *
 *   - Successful lookups are not throttled. A 256-bit token already proves the holder
 *     was given the link; re-reading your own invitation is not abuse.
 *   - Failed lookups are throttled per IP. That is the enumeration signal, and honest
 *     guests essentially never generate it.
 *   - RSVP submissions are throttled per **token**, so one hammered invitation cannot
 *     affect anyone else's household, with a generous per-IP ceiling behind it to stop
 *     someone POSTing en masse from one machine.
 */

/** Failed invitation lookups from one address — the enumeration signal. */
export const invitationFailureLimiter = createInMemoryRateLimiter({
  limit: 20,
  windowMs: 60_000,
})

/** Submissions against a single invitation token. */
export const rsvpTokenLimiter = createInMemoryRateLimiter({
  limit: 20,
  windowMs: 60_000,
})

/**
 * Ceiling on RSVP submissions from one address.
 *
 * Deliberately high: a coach party sharing the venue wifi may all reply within minutes.
 * It exists to stop scripted flooding, not to police guests.
 */
export const rsvpAddressLimiter = createInMemoryRateLimiter({
  limit: 300,
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
