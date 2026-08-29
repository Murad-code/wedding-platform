import { headers } from 'next/headers'

import { rsvpSubmissionSchema } from '@/domain/rsvp/schema'
import { isRsvpOpen } from '@/domain/wedding/settings'
import { findPartyByToken } from '@/lib/invitations'
import { clientIp, rsvpSubmissionLimiter } from '@/lib/rate-limit'
import { submitRsvp } from '@/lib/rsvp'
import { getWeddingSettings } from '@/lib/wedding'

export const dynamic = 'force-dynamic'

/**
 * Accepts a party's RSVP.
 *
 * Everything here is re-checked server-side regardless of what the form allowed: the
 * token, the deadline, the payload shape, and whether the submitted guests belong to
 * the resolved party (docs/SECURITY.md §6).
 */
export async function POST(request: Request) {
  const requestHeaders = await headers()
  const ip = clientIp(requestHeaders)

  if (!rsvpSubmissionLimiter.check(ip).allowed) {
    return Response.json(
      { error: 'Too many attempts. Please wait a moment and try again.' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest('We could not read that submission.')
  }

  if (!body || typeof body !== 'object') return badRequest('We could not read that submission.')

  // The token comes from the request body rather than a party id: the party is always
  // derived from the token, never supplied by the client.
  const { token, ...rest } = body as Record<string, unknown>

  const party = await findPartyByToken(token)
  if (!party) {
    // Same generic response as an unknown token elsewhere — no oracle.
    return Response.json(
      { error: 'That invitation could not be found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const settings = await getWeddingSettings()
  if (!isRsvpOpen(settings)) {
    // Enforced here, not by hiding the button (docs/SECURITY.md T7).
    return Response.json(
      { error: 'The RSVP deadline has passed. Please contact the couple directly.' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const parsed = rsvpSubmissionSchema.safeParse(rest)
  if (!parsed.success) {
    return badRequest('Some of those answers were not valid. Please check and try again.')
  }

  const result = await submitRsvp({ party, submission: parsed.data, ip })

  if (!result.ok) {
    if (result.reason === 'foreign-guest') {
      return badRequest('That response did not match your invitation.')
    }
    return Response.json(
      { error: 'We could not save your response. Please try again.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

function badRequest(message: string) {
  return Response.json(
    { error: message },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  )
}
