'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import { z } from 'zod'

import { isQueueAction, reorder, type QueueSnapshot } from '@/domain/photo-queue/queue'
import { recordAuditEvent } from '@/lib/audit'
import { requireMutator } from '@/lib/auth/session'
import { getPhotoGroups, getSnapshot, notifyQueueChanged, runQueueAction } from '@/lib/photo-queue'

export type PhotoGroupState = { error?: string; ok?: boolean; message?: string }

/** Every write here changes what guests see, so both surfaces are revalidated. */
function revalidate() {
  revalidatePath('/dashboard/photos')
  revalidatePath('/dashboard/photos/run')
  revalidatePath('/photos')
}

const groupSchema = z.object({
  name: z.string().trim().min(1, 'Give the photo a name').max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((value) => (value.length === 0 ? null : value)),
  estimatedMinutes: z
    .union([z.coerce.number().int().min(1).max(120), z.literal('')])
    .transform((value) => (value === '' ? null : value)),
})

export async function addPhotoGroup(
  _previous: PhotoGroupState,
  formData: FormData,
): Promise<PhotoGroupState> {
  const session = await requireMutator()

  const parsed = groupSchema.safeParse({
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    estimatedMinutes: formData.get('estimatedMinutes') ?? '',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those details were not valid.' }
  }

  const payload = await getPayload({ config })
  const existing = await getPhotoGroups()

  try {
    const created = await payload.create({
      collection: 'photo-groups',
      overrideAccess: true,
      // Added to the end of the run; the organiser reorders from there.
      data: { ...parsed.data, order: existing.length, status: 'queued' },
    })

    await recordAuditEvent({
      action: 'photo-group.created',
      actorType: 'user',
      actorUserId: session.actor.id,
      entityType: 'photo-groups',
      entityId: String(created.id),
    })
  } catch {
    // Names are unique so the photographer never calls out an ambiguous group.
    return { error: `There is already a photograph called “${parsed.data.name}”.` }
  }

  await notifyQueueChanged()
  revalidate()
  return { ok: true, message: `Added “${parsed.data.name}”.` }
}

const idSchema = z.coerce.number().int().positive()

export async function deletePhotoGroup(
  _previous: PhotoGroupState,
  formData: FormData,
): Promise<PhotoGroupState> {
  const session = await requireMutator()

  const id = idSchema.safeParse(formData.get('id'))
  if (!id.success) return { error: 'That photo could not be found.' }

  const payload = await getPayload({ config })
  await payload.delete({ collection: 'photo-groups', id: id.data, overrideAccess: true })

  await recordAuditEvent({
    action: 'photo-group.deleted',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'photo-groups',
    entityId: String(id.data),
  })

  await notifyQueueChanged()
  revalidate()
  return { ok: true }
}

export async function movePhotoGroup(
  _previous: PhotoGroupState,
  formData: FormData,
): Promise<PhotoGroupState> {
  await requireMutator()

  const parsed = z
    .object({ id: idSchema, direction: z.enum(['up', 'down']) })
    .safeParse({ id: formData.get('id') ?? '', direction: formData.get('direction') ?? '' })

  if (!parsed.success) return { error: 'That photo could not be moved.' }

  const groups = await getPhotoGroups()
  const changes = reorder(groups, parsed.data.id, parsed.data.direction)
  if (changes.length === 0) return { ok: true }

  const payload = await getPayload({ config })
  for (const change of changes) {
    await payload.update({
      collection: 'photo-groups',
      id: change.id,
      data: { order: change.order },
      overrideAccess: true,
    })
  }

  await notifyQueueChanged()
  revalidate()
  return { ok: true }
}

const membershipSchema = z.object({ groupId: idSchema, guestId: idSchema })

/** Adds or removes one guest, leaving the rest of the membership untouched. */
async function changeMembership(
  formData: FormData,
  change: 'add' | 'remove',
): Promise<PhotoGroupState> {
  const session = await requireMutator()

  const parsed = membershipSchema.safeParse({
    groupId: formData.get('groupId') ?? '',
    guestId: formData.get('guestId') ?? '',
  })
  if (!parsed.success) return { error: 'That change was not valid.' }

  const groups = await getPhotoGroups()
  const group = groups.find((candidate) => candidate.id === parsed.data.groupId)
  if (!group) return { error: 'That photo could not be found.' }

  const members =
    change === 'add'
      ? [...new Set([...group.memberIds, parsed.data.guestId])]
      : group.memberIds.filter((memberId) => memberId !== parsed.data.guestId)

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'photo-groups',
    id: group.id,
    data: { members },
    overrideAccess: true,
  })

  await recordAuditEvent({
    action: change === 'add' ? 'photo-group.member-added' : 'photo-group.member-removed',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'photo-groups',
    entityId: String(group.id),
  })

  await notifyQueueChanged()
  revalidate()
  return { ok: true }
}

export async function addGroupMember(
  _previous: PhotoGroupState,
  formData: FormData,
): Promise<PhotoGroupState> {
  return changeMembership(formData, 'add')
}

export async function removeGroupMember(
  _previous: PhotoGroupState,
  formData: FormData,
): Promise<PhotoGroupState> {
  return changeMembership(formData, 'remove')
}

export type ControllerResult =
  { ok: true; snapshot: QueueSnapshot } | { ok: false; error: string; snapshot: QueueSnapshot }

/**
 * The wedding-day controller's four buttons.
 *
 * Called with the revision the organiser's screen was showing. If it no longer matches,
 * someone else has moved the queue on and this press is refused rather than applied on
 * top — at a real wedding two people hold the controller, and a double advance means a
 * group never gets photographed.
 */
export async function performQueueAction(
  action: string,
  expectedRevision: number,
): Promise<ControllerResult> {
  const session = await requireMutator()

  if (!isQueueAction(action)) {
    return {
      ok: false,
      error: 'That is not something the controller can do.',
      snapshot: await getSnapshot(),
    }
  }

  const result = await runQueueAction(action, expectedRevision)

  if (!result.ok) {
    return {
      ok: false,
      error: 'Someone else moved the queue on. This is now up to date.',
      snapshot: result.snapshot,
    }
  }

  await recordAuditEvent({
    action: `photo-queue.${action}`,
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'photo-queue-state',
    entityId: String(result.snapshot.revision),
  })

  revalidate()
  return { ok: true, snapshot: result.snapshot }
}
