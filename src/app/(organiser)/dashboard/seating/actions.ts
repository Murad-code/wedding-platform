'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import { z } from 'zod'

import { TABLE_SHAPES } from '@/domain/seating/seating'
import { recordAuditEvent } from '@/lib/audit'
import { requireMutator } from '@/lib/auth/session'

export type SeatingState = { error?: string; ok?: boolean }

const tableSchema = z.object({
  name: z.string().trim().min(1, 'Give the table a name').max(120),
  capacity: z.coerce.number().int().min(1, 'A table needs at least one seat').max(100),
  shape: z.enum(TABLE_SHAPES),
  order: z.coerce.number().int().min(0).max(9999),
  notes: z
    .string()
    .trim()
    .max(500)
    .transform((value) => (value.length === 0 ? null : value)),
})

export async function addTable(_previous: SeatingState, formData: FormData): Promise<SeatingState> {
  const session = await requireMutator()

  const parsed = tableSchema.safeParse({
    name: formData.get('name') ?? '',
    capacity: formData.get('capacity') ?? 8,
    shape: formData.get('shape') ?? 'round',
    order: formData.get('order') ?? 0,
    notes: formData.get('notes') ?? '',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those details were not valid.' }
  }

  const payload = await getPayload({ config })

  try {
    const created = await payload.create({
      collection: 'tables',
      overrideAccess: true,
      data: parsed.data,
    })

    await recordAuditEvent({
      action: 'table.created',
      actorType: 'user',
      actorUserId: session.actor.id,
      entityType: 'tables',
      entityId: String(created.id),
    })
  } catch {
    // Table names are unique so the plan reads unambiguously; say so plainly rather
    // than surfacing a database error.
    return { error: `There is already a table called "${parsed.data.name}".` }
  }

  revalidatePath('/dashboard/seating')
  return { ok: true }
}

export async function deleteTable(
  _previous: SeatingState,
  formData: FormData,
): Promise<SeatingState> {
  const session = await requireMutator()

  const id = z.coerce.number().int().positive().safeParse(formData.get('id'))
  if (!id.success) return { error: 'That table could not be found.' }

  const payload = await getPayload({ config })
  // The collection's beforeDelete hook returns its guests to unassigned.
  await payload.delete({ collection: 'tables', id: id.data, overrideAccess: true })

  await recordAuditEvent({
    action: 'table.deleted',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'tables',
    entityId: String(id.data),
  })

  revalidatePath('/dashboard/seating')
  revalidatePath('/dashboard/guests')
  return { ok: true }
}

const assignSchema = z.object({
  guestId: z.coerce.number().int().positive(),
  // An empty string means "return to unassigned", which is a legitimate move.
  tableId: z
    .union([z.coerce.number().int().positive(), z.literal('')])
    .transform((value) => (value === '' ? null : value)),
})

/**
 * Seats a guest, or returns them to the unassigned pane.
 *
 * Capacity is deliberately not enforced: an organiser adding a ninth chair to an
 * eight-person table knows their venue better than we do (docs/UX.md 3.3).
 */
export async function assignGuestToTable(
  _previous: SeatingState,
  formData: FormData,
): Promise<SeatingState> {
  const session = await requireMutator()

  const parsed = assignSchema.safeParse({
    guestId: formData.get('guestId') ?? '',
    tableId: formData.get('tableId') ?? '',
  })

  if (!parsed.success) return { error: 'That seat change was not valid.' }

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'guests',
    id: parsed.data.guestId,
    overrideAccess: true,
    data: { table: parsed.data.tableId },
  })

  await recordAuditEvent({
    action: parsed.data.tableId === null ? 'seating.unassigned' : 'seating.assigned',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'guests',
    entityId: String(parsed.data.guestId),
  })

  revalidatePath('/dashboard/seating')
  revalidatePath('/dashboard/guests')
  return { ok: true }
}

/**
 * Programmatic form of {@link assignGuestToTable}, for the planner.
 *
 * Drag-and-drop and the keyboard select both call this, so there is exactly one write
 * path and one place where authorisation and validation happen.
 */
export async function moveGuest(guestId: number, tableId: number | null): Promise<SeatingState> {
  const formData = new FormData()
  formData.set('guestId', String(guestId))
  formData.set('tableId', tableId === null ? '' : String(tableId))
  return assignGuestToTable({}, formData)
}
