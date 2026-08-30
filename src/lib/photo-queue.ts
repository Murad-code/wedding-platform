import config from '@payload-config'
import { getPayload } from 'payload'

import { guestDisplayName } from '@/domain/guests/guest'
import {
  applyAction,
  isPhotoGroupStatus,
  normalise,
  ordered,
  toPublicGroup,
  type PhotoGroup,
  type QueueAction,
  type QueueSnapshot,
} from '@/domain/photo-queue/queue'
import type { PhotoGroup as PhotoGroupDoc } from '@/payload-types'

import { photoQueueTransport } from './realtime'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function memberIds(members: PhotoGroupDoc['members']): number[] {
  if (!Array.isArray(members)) return []
  return members.map((member) => (typeof member === 'number' ? member : member.id))
}

function toPhotoGroup(doc: PhotoGroupDoc): PhotoGroup {
  return {
    id: doc.id,
    name: doc.name,
    description: text(doc.description),
    estimatedMinutes: typeof doc.estimatedMinutes === 'number' ? doc.estimatedMinutes : null,
    order: doc.order ?? 0,
    // A status the code does not recognise is treated as still to come rather than
    // silently dropping the group out of the run.
    status: isPhotoGroupStatus(doc.status) ? doc.status : 'queued',
    memberIds: memberIds(doc.members),
  }
}

/** Every group, with membership. Organiser-side only — never sent to a browser. */
export async function getPhotoGroups(): Promise<PhotoGroup[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'photo-groups',
    limit: 200,
    sort: 'order',
    depth: 0,
    overrideAccess: true,
  })

  // Normalised on read as well as on write, so "up next" is always derived from the
  // current run rather than from a flag that a direct edit in Payload admin could leave
  // pointing at a group that has already been photographed.
  return normalise(result.docs.map(toPhotoGroup))
}

export async function getRevision(): Promise<number> {
  const payload = await getPayload({ config })
  const state = await payload.findGlobal({
    slug: 'photo-queue-state',
    depth: 0,
    overrideAccess: true,
  })

  return typeof state.revision === 'number' ? state.revision : 0
}

/**
 * What a guest's phone receives.
 *
 * `toPublicGroup` is the boundary: it drops membership, so the stream carries the
 * photographer's running order and nothing about who is in each photograph.
 */
export async function getSnapshot(): Promise<QueueSnapshot> {
  const [groups, revision] = await Promise.all([getPhotoGroups(), getRevision()])
  return { revision, groups: groups.map(toPublicGroup) }
}

/**
 * The group ids one party belongs to.
 *
 * Resolved on the server from the party's own guests, so a guest's page can highlight
 * their groups without the browser ever learning who else is in them.
 */
export async function groupIdsForGuests(guestIds: readonly number[]): Promise<number[]> {
  if (guestIds.length === 0) return []

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'photo-groups',
    where: { members: { in: [...guestIds] } },
    limit: 200,
    sort: 'order',
    depth: 0,
    overrideAccess: true,
  })

  return result.docs.map((doc) => doc.id)
}

export type QueueActionResult =
  { ok: true; snapshot: QueueSnapshot } | { ok: false; reason: 'stale'; snapshot: QueueSnapshot }

/**
 * Applies one of the controller's buttons and tells every connected phone.
 *
 * `expectedRevision` is optimistic concurrency, and it is not theoretical: at a real
 * wedding the couple's planner and the photographer's assistant both have the controller
 * open, and both press Call Next when the group forms up. Without this, the queue would
 * jump two groups and someone would miss their photograph.
 */
export async function runQueueAction(
  action: QueueAction,
  expectedRevision?: number,
): Promise<QueueActionResult> {
  const payload = await getPayload({ config })
  const transactionID = await payload.db.beginTransaction()
  const req = transactionID === null ? undefined : { transactionID }

  try {
    const state = await payload.findGlobal({
      slug: 'photo-queue-state',
      depth: 0,
      overrideAccess: true,
      req,
    })
    const revision = typeof state.revision === 'number' ? state.revision : 0

    if (expectedRevision !== undefined && expectedRevision !== revision) {
      if (transactionID !== null) await payload.db.rollbackTransaction(transactionID)
      return { ok: false, reason: 'stale', snapshot: await getSnapshot() }
    }

    const result = await payload.find({
      collection: 'photo-groups',
      limit: 200,
      sort: 'order',
      depth: 0,
      overrideAccess: true,
      req,
    })

    const before = ordered(result.docs.map(toPhotoGroup))
    const after = applyAction(before, action)

    // Write only what moved. Most actions touch two rows out of thirty.
    const changed = after.filter(
      (group) => before.find((original) => original.id === group.id)?.status !== group.status,
    )

    for (const group of changed) {
      await payload.update({
        collection: 'photo-groups',
        id: group.id,
        data: { status: group.status },
        overrideAccess: true,
        req,
      })
    }

    const next = revision + 1
    await payload.updateGlobal({
      slug: 'photo-queue-state',
      data: { revision: next, lastActionAt: new Date().toISOString() },
      overrideAccess: true,
      req,
    })

    if (transactionID !== null) await payload.db.commitTransaction(transactionID)

    // Published only after the commit: a phone that reacted to an event and then
    // refetched could otherwise read the state from before the write landed.
    const snapshot: QueueSnapshot = { revision: next, groups: after.map(toPublicGroup) }
    publish(snapshot)

    return { ok: true, snapshot }
  } catch (error) {
    if (transactionID !== null) await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}

/**
 * Bumps the revision and broadcasts, for changes that are not queue actions — a group
 * added, renamed, reordered, or deleted while the run is under way.
 */
export async function notifyQueueChanged(): Promise<QueueSnapshot> {
  const payload = await getPayload({ config })
  const revision = (await getRevision()) + 1

  await payload.updateGlobal({
    slug: 'photo-queue-state',
    data: { revision, lastActionAt: new Date().toISOString() },
    overrideAccess: true,
  })

  const groups = await getPhotoGroups()
  const snapshot: QueueSnapshot = { revision, groups: groups.map(toPublicGroup) }
  publish(snapshot)

  return snapshot
}

function publish(snapshot: QueueSnapshot) {
  photoQueueTransport().publish({
    name: 'queue.updated',
    revision: snapshot.revision,
    data: snapshot,
  })
}

export type PhotographableGuest = { id: number; displayName: string; partyName: string }

/**
 * Who can be put in a photograph.
 *
 * Attending guests only. A declined guest in a photo group would have the photographer
 * calling for someone who is not at the wedding, and holding the whole run up while
 * people look for them.
 */
export async function getPhotographableGuests(): Promise<PhotographableGuest[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'guests',
    where: { rsvpStatus: { equals: 'attending' } },
    limit: 2000,
    sort: 'lastName',
    depth: 1,
    overrideAccess: true,
  })

  return result.docs
    .map((guest) => ({
      id: guest.id,
      displayName: guestDisplayName(guest.firstName, text(guest.lastName)),
      partyName:
        guest.party && typeof guest.party === 'object' ? (guest.party.displayName ?? '') : '',
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}
