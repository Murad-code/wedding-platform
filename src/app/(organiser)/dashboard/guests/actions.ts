'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import { z } from 'zod'

import { parseGuestCsv, type CsvRowError } from '@/domain/guests/csv'
import { AGE_GROUPS } from '@/domain/guests/guest'
import { RSVP_STATUSES } from '@/domain/rsvp/status'
import { recordAuditEvent } from '@/lib/audit'
import { requireMutator } from '@/lib/auth/session'
import { importGuests, type ImportOutcome } from '@/lib/guest-list'

export type ActionState = { error?: string; ok?: boolean }

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional()

const updateGuestSchema = z.object({
  guestId: z.coerce.number().int().positive(),
  firstName: z.string().trim().min(1, 'A first name is required').max(100),
  lastName: optionalText(100),
  ageGroup: z.enum(AGE_GROUPS),
  rsvpStatus: z.enum(RSVP_STATUSES),
  isPlusOne: z.coerce.boolean().default(false),
  email: z.union([z.string().trim().email(), z.literal('')]).optional(),
  phone: optionalText(40),
  dietaryRequirements: optionalText(500),
  allergies: optionalText(500),
  accessibilityNeeds: optionalText(500),
  internalNotes: optionalText(1000),
})

/** Every server action re-establishes authorisation and re-validates its input. */
export async function updateGuest(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireMutator()

  const parsed = updateGuestSchema.safeParse({
    guestId: formData.get('guestId'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName') ?? '',
    ageGroup: formData.get('ageGroup') ?? 'adult',
    rsvpStatus: formData.get('rsvpStatus') ?? 'pending',
    isPlusOne: formData.get('isPlusOne') === 'on',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    dietaryRequirements: formData.get('dietaryRequirements') ?? '',
    allergies: formData.get('allergies') ?? '',
    accessibilityNeeds: formData.get('accessibilityNeeds') ?? '',
    internalNotes: formData.get('internalNotes') ?? '',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those details were not valid.' }
  }

  const { guestId, email, ...rest } = parsed.data
  const payload = await getPayload({ config })

  await payload.update({
    collection: 'guests',
    id: guestId,
    overrideAccess: true,
    data: { ...rest, email: email || null },
  })

  await recordAuditEvent({
    action: 'guest.updated',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'guests',
    entityId: String(guestId),
  })

  revalidatePath('/dashboard/guests')
  revalidatePath(`/dashboard/guests/${guestId}`)
  revalidatePath('/dashboard')
  return { ok: true }
}

const bulkSchema = z.object({
  guestIds: z.array(z.coerce.number().int().positive()).min(1, 'Select at least one guest'),
  action: z.enum(['delete', 'markAttending', 'markDeclined', 'markPending']),
})

export async function bulkUpdateGuests(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireMutator()

  const parsed = bulkSchema.safeParse({
    guestIds: formData.getAll('guestIds'),
    action: formData.get('action'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That bulk action was not valid.' }
  }

  const { guestIds, action } = parsed.data
  const payload = await getPayload({ config })

  if (action === 'delete') {
    await payload.delete({
      collection: 'guests',
      where: { id: { in: guestIds } },
      overrideAccess: true,
    })
  } else {
    const rsvpStatus =
      action === 'markAttending' ? 'attending' : action === 'markDeclined' ? 'declined' : 'pending'

    await payload.update({
      collection: 'guests',
      where: { id: { in: guestIds } },
      overrideAccess: true,
      data: { rsvpStatus },
    })
  }

  await recordAuditEvent({
    action: `guest.bulk.${action}`,
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'guests',
    // Counts only — the audit log is not the place for a list of guest ids.
    metadata: { count: guestIds.length },
  })

  revalidatePath('/dashboard/guests')
  revalidatePath('/dashboard')
  return { ok: true }
}

export type ImportState = {
  error?: string
  errors?: CsvRowError[]
  duplicates?: CsvRowError[]
  preview?: { party: string; name: string; ageGroup: string }[]
  outcome?: ImportOutcome
  /** The validated CSV, echoed back so confirming does not require re-uploading. */
  csv?: string
}

const MAX_UPLOAD_BYTES = 1_000_000

/**
 * Validates an uploaded CSV and returns a preview.
 *
 * Deliberately does not write anything: an organiser pasting the wrong column order
 * should see what would happen before it happens.
 */
export async function previewGuestImport(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireMutator()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a CSV file to import.' }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: 'That file is too large. The limit is 1 MB.' }
  }

  // Read once: a File's stream cannot be consumed twice.
  const csv = await file.text()
  const { rows, errors, duplicates } = parseGuestCsv(csv)

  if (rows.length === 0) {
    return {
      error: errors[0]?.message ?? 'No guests could be read from that file.',
      errors,
      duplicates,
    }
  }

  return {
    errors,
    duplicates,
    csv,
    preview: rows.slice(0, 20).map((row) => ({
      party: row.party,
      name: [row.firstName, row.lastName].filter(Boolean).join(' '),
      ageGroup: row.ageGroup,
    })),
  }
}

/** Applies an import the organiser has already previewed and confirmed. */
export async function confirmGuestImport(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const session = await requireMutator()

  const csv = formData.get('csv')
  if (typeof csv !== 'string' || csv.length === 0) {
    return { error: 'That import expired. Please choose the file again.' }
  }
  if (csv.length > MAX_UPLOAD_BYTES) {
    return { error: 'That file is too large. The limit is 1 MB.' }
  }

  // Re-parsed rather than trusting a client-supplied row list.
  const { rows, errors, duplicates } = parseGuestCsv(csv)
  if (rows.length === 0) {
    return { error: 'No guests could be read from that file.', errors, duplicates }
  }

  const outcome = await importGuests(rows)

  await recordAuditEvent({
    action: 'guest.imported',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'guests',
    metadata: { ...outcome },
  })

  revalidatePath('/dashboard/guests')
  revalidatePath('/dashboard/parties')
  revalidatePath('/dashboard')
  return { outcome, errors, duplicates }
}
