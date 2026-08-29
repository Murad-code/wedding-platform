'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { z } from 'zod'

import { AGE_GROUPS } from '@/domain/guests/guest'
import { recordAuditEvent } from '@/lib/audit'
import { requireMutator } from '@/lib/auth/session'
import { issueInvitationToken } from '@/lib/invitations'

const createPartySchema = z.object({
  displayName: z.string().trim().min(1, 'Give this group a name').max(200),
  plusOnesAllowed: z.coerce.number().int().min(0).max(10).default(0),
})

const addGuestSchema = z.object({
  partyId: z.coerce.number().int().positive(),
  firstName: z.string().trim().min(1, 'A first name is required').max(100),
  lastName: z.string().trim().max(100).optional(),
  ageGroup: z.enum(AGE_GROUPS),
})

export type ActionState = { error?: string; ok?: boolean }

/**
 * Server actions are a public entry point like any route handler, so each one
 * re-establishes authorisation and re-validates its input (docs/SECURITY.md §5, §6).
 */
export async function createParty(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireMutator()

  const parsed = createPartySchema.safeParse({
    displayName: formData.get('displayName'),
    plusOnesAllowed: formData.get('plusOnesAllowed') || 0,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those details were not valid.' }
  }

  const payload = await getPayload({ config })
  const party = await payload.create({
    collection: 'invitation-parties',
    overrideAccess: true,
    data: { ...parsed.data, status: 'pending' },
  })

  await recordAuditEvent({
    action: 'party.created',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'invitation-parties',
    entityId: String(party.id),
  })

  revalidatePath('/dashboard/parties')

  // Go straight to the new party: the next thing an organiser wants is to add the
  // people in it, and hunting for it in a paginated alphabetical list is busywork.
  // `redirect` throws its own control-flow signal, so it must be the last statement.
  redirect(`/dashboard/parties/${party.id}`)
}

export async function addGuest(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireMutator()

  const parsed = addGuestSchema.safeParse({
    partyId: formData.get('partyId'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName') || undefined,
    ageGroup: formData.get('ageGroup') || 'adult',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those details were not valid.' }
  }

  const { partyId, ...guest } = parsed.data
  const payload = await getPayload({ config })

  const created = await payload.create({
    collection: 'guests',
    overrideAccess: true,
    data: { ...guest, party: partyId, rsvpStatus: 'pending' },
  })

  await recordAuditEvent({
    action: 'guest.created',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'guests',
    entityId: String(created.id),
  })

  revalidatePath(`/dashboard/parties/${partyId}`)
  revalidatePath('/dashboard')
  return { ok: true }
}

/**
 * Issues (or rotates) a party's invitation link.
 *
 * The raw token is returned to the caller for display and is never stored, so this is
 * the only moment it exists outside the guest's browser (ADR-005). Rotating invalidates
 * the previous link immediately.
 */
export async function issueInvitation(
  _previous: ActionState & { token?: string },
  formData: FormData,
): Promise<ActionState & { token?: string }> {
  const session = await requireMutator()

  const partyId = z.coerce.number().int().positive().safeParse(formData.get('partyId'))
  if (!partyId.success) return { error: 'That party could not be found.' }

  const token = await issueInvitationToken(partyId.data)

  await recordAuditEvent({
    action: 'invitation.issued',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'invitation-parties',
    entityId: String(partyId.data),
    // Deliberately records that a token was issued, never the token itself.
  })

  revalidatePath(`/dashboard/parties/${partyId.data}`)
  return { ok: true, token }
}
