'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import { z } from 'zod'

import { recordAuditEvent } from '@/lib/audit'
import { requireMutator } from '@/lib/auth/session'

export type ContactState = { error?: string; ok?: boolean }

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))

const contactSchema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(120),
  role: optionalText(120),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === '' || value.includes('@'), {
      message: 'That does not look like an email address.',
    })
    .transform((value) => (value.length === 0 ? null : value)),
  visibleToGuests: z.coerce.boolean().default(false),
  order: z.coerce.number().int().min(0).max(9999),
})

export async function addContact(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const session = await requireMutator()

  const parsed = contactSchema.safeParse({
    name: formData.get('name') ?? '',
    role: formData.get('role') ?? '',
    phone: formData.get('phone') ?? '',
    whatsapp: formData.get('whatsapp') ?? '',
    email: formData.get('email') ?? '',
    visibleToGuests: formData.get('visibleToGuests') === 'on',
    order: formData.get('order') ?? 0,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those details were not valid.' }
  }

  const payload = await getPayload({ config })
  const created = await payload.create({
    collection: 'wedding-contacts',
    overrideAccess: true,
    data: parsed.data,
  })

  await recordAuditEvent({
    action: 'contact.created',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'wedding-contacts',
    entityId: String(created.id),
  })

  revalidatePath('/dashboard/contacts')
  revalidatePath('/contact')
  return { ok: true }
}

export async function toggleContactVisibility(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const session = await requireMutator()

  const id = z.coerce.number().int().positive().safeParse(formData.get('id'))
  const visible = formData.get('visible') === 'true'
  if (!id.success) return { error: 'That contact could not be found.' }

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'wedding-contacts',
    id: id.data,
    overrideAccess: true,
    data: { visibleToGuests: visible },
  })

  await recordAuditEvent({
    action: 'contact.visibility',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'wedding-contacts',
    entityId: String(id.data),
    metadata: { visibleToGuests: visible },
  })

  revalidatePath('/dashboard/contacts')
  revalidatePath('/contact')
  return { ok: true }
}

export async function deleteContact(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const session = await requireMutator()

  const id = z.coerce.number().int().positive().safeParse(formData.get('id'))
  if (!id.success) return { error: 'That contact could not be found.' }

  const payload = await getPayload({ config })
  await payload.delete({ collection: 'wedding-contacts', id: id.data, overrideAccess: true })

  await recordAuditEvent({
    action: 'contact.deleted',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'wedding-contacts',
    entityId: String(id.data),
  })

  revalidatePath('/dashboard/contacts')
  revalidatePath('/contact')
  return { ok: true }
}
