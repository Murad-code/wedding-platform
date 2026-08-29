import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { toActor } from '@/domain/auth/access'
import { type Actor, canManageTeam, canMutate } from '@/domain/auth/roles'

export type Session = {
  actor: NonNullable<Actor>
  name: string
  email: string
}

/**
 * Resolves the signed-in organiser, or null.
 *
 * This is the authoritative check. `proxy.ts` only inspects cookie presence to avoid a
 * pointless render, per Next's guidance that proxy must not rely on shared modules.
 */
export async function getSession(): Promise<Session | null> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })

  const actor = toActor(user)
  if (!actor || !user) return null

  return {
    actor,
    name: typeof user.name === 'string' ? user.name : '',
    email: typeof user.email === 'string' ? user.email : '',
  }
}

/**
 * Guards an organiser page or route handler. Redirects to login when unauthenticated.
 *
 * Server-side authorisation is required regardless of what the UI shows
 * (docs/SECURITY.md §5).
 */
export async function requireOrganiser(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

/** Guards an action a `viewer` must not perform. */
export async function requireMutator(): Promise<Session> {
  const session = await requireOrganiser()
  if (!canMutate(session.actor)) redirect('/dashboard?denied=1')
  return session
}

/** Guards team administration. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireOrganiser()
  if (!canManageTeam(session.actor)) redirect('/dashboard?denied=1')
  return session
}
