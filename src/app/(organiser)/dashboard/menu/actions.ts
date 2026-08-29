'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import { z } from 'zod'

import { recordAuditEvent } from '@/lib/audit'
import { requireMutator } from '@/lib/auth/session'

export type MenuState = { error?: string; ok?: boolean }

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))

const courseSchema = z.object({
  name: z.string().trim().min(1, 'Give the course a name').max(120),
  description: optionalText(500),
  order: z.coerce.number().int().min(0).max(9999),
  required: z.coerce.boolean().default(false),
  childrenOnly: z.coerce.boolean().default(false),
})

const optionSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, 'Give the option a name').max(160),
  description: optionalText(500),
  order: z.coerce.number().int().min(0).max(9999),
  isVegetarian: z.coerce.boolean().default(false),
  isVegan: z.coerce.boolean().default(false),
  isGlutenFree: z.coerce.boolean().default(false),
})

export async function addCourse(_previous: MenuState, formData: FormData): Promise<MenuState> {
  const session = await requireMutator()

  const parsed = courseSchema.safeParse({
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    order: formData.get('order') ?? 0,
    required: formData.get('required') === 'on',
    childrenOnly: formData.get('childrenOnly') === 'on',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those details were not valid.' }
  }

  const payload = await getPayload({ config })
  const created = await payload.create({
    collection: 'menu-courses',
    overrideAccess: true,
    data: parsed.data,
  })

  await recordAuditEvent({
    action: 'menu.course.created',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'menu-courses',
    entityId: String(created.id),
  })

  revalidateMenu()
  return { ok: true }
}

export async function addOption(_previous: MenuState, formData: FormData): Promise<MenuState> {
  const session = await requireMutator()

  const parsed = optionSchema.safeParse({
    courseId: formData.get('courseId') ?? '',
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    order: formData.get('order') ?? 0,
    isVegetarian: formData.get('isVegetarian') === 'on',
    isVegan: formData.get('isVegan') === 'on',
    isGlutenFree: formData.get('isGlutenFree') === 'on',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those details were not valid.' }
  }

  const { courseId, ...option } = parsed.data
  const payload = await getPayload({ config })

  const created = await payload.create({
    collection: 'menu-options',
    overrideAccess: true,
    data: { ...option, course: courseId },
  })

  await recordAuditEvent({
    action: 'menu.option.created',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'menu-options',
    entityId: String(created.id),
  })

  revalidateMenu()
  return { ok: true }
}

export async function deleteCourse(_previous: MenuState, formData: FormData): Promise<MenuState> {
  const session = await requireMutator()

  const id = z.coerce.number().int().positive().safeParse(formData.get('id'))
  if (!id.success) return { error: 'That course could not be found.' }

  const payload = await getPayload({ config })
  // The collection's beforeDelete hook removes its options and any choices made from
  // them, so no guest is left pointing at a course that no longer exists.
  await payload.delete({ collection: 'menu-courses', id: id.data, overrideAccess: true })

  await recordAuditEvent({
    action: 'menu.course.deleted',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'menu-courses',
    entityId: String(id.data),
  })

  revalidateMenu()
  return { ok: true }
}

export async function deleteOption(_previous: MenuState, formData: FormData): Promise<MenuState> {
  const session = await requireMutator()

  const id = z.coerce.number().int().positive().safeParse(formData.get('id'))
  if (!id.success) return { error: 'That option could not be found.' }

  const payload = await getPayload({ config })
  await payload.delete({ collection: 'menu-options', id: id.data, overrideAccess: true })

  await recordAuditEvent({
    action: 'menu.option.deleted',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'menu-options',
    entityId: String(id.data),
  })

  revalidateMenu()
  return { ok: true }
}

function revalidateMenu() {
  revalidatePath('/dashboard/menu')
  revalidatePath('/menu')
}
