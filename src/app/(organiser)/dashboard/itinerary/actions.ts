'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import { z } from 'zod'

import { ITINERARY_VISIBILITY } from '@/domain/itinerary/item'
import { recordAuditEvent } from '@/lib/audit'
import { requireMutator } from '@/lib/auth/session'

export type ItineraryState = { error?: string; ok?: boolean }

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .refine((value) => value === null || !Number.isNaN(new Date(value).getTime()), {
    message: 'That time could not be understood.',
  })

const itemSchema = z.object({
  title: z.string().trim().min(1, 'Give this moment a name').max(200),
  startTime: optionalDate,
  endTime: optionalDate,
  location: optionalText(200),
  description: optionalText(1000),
  visibility: z.enum(ITINERARY_VISIBILITY),
  order: z.coerce.number().int().min(0).max(9999),
})

export async function addItineraryItem(
  _previous: ItineraryState,
  formData: FormData,
): Promise<ItineraryState> {
  const session = await requireMutator()

  const parsed = itemSchema.safeParse({
    title: formData.get('title') ?? '',
    startTime: formData.get('startTime') ?? '',
    endTime: formData.get('endTime') ?? '',
    location: formData.get('location') ?? '',
    description: formData.get('description') ?? '',
    visibility: formData.get('visibility') ?? 'guests',
    order: formData.get('order') ?? 0,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those details were not valid.' }
  }

  const payload = await getPayload({ config })
  const created = await payload.create({
    collection: 'itinerary-items',
    overrideAccess: true,
    data: parsed.data,
  })

  await recordAuditEvent({
    action: 'itinerary.created',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'itinerary-items',
    entityId: String(created.id),
  })

  revalidatePath('/dashboard/itinerary')
  revalidatePath('/our-day')
  return { ok: true }
}

export async function deleteItineraryItem(
  _previous: ItineraryState,
  formData: FormData,
): Promise<ItineraryState> {
  const session = await requireMutator()

  const id = z.coerce.number().int().positive().safeParse(formData.get('id'))
  if (!id.success) return { error: 'That item could not be found.' }

  const payload = await getPayload({ config })
  await payload.delete({ collection: 'itinerary-items', id: id.data, overrideAccess: true })

  await recordAuditEvent({
    action: 'itinerary.deleted',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'itinerary-items',
    entityId: String(id.data),
  })

  revalidatePath('/dashboard/itinerary')
  revalidatePath('/our-day')
  return { ok: true }
}
