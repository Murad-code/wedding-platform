/**
 * The wedding-day photo queue.
 *
 * This is the product's differentiator: instead of a photographer shouting names across a
 * lawn for half an hour, every guest's phone shows who is being photographed now, who is
 * next, and how far away their own group is.
 *
 * Everything here is pure. The same functions run on the server to build a snapshot and
 * in the browser to recompute a guest's position when an event arrives, which is what
 * keeps the two views from disagreeing.
 */

export const PHOTO_GROUP_STATUSES = ['queued', 'get_ready', 'now', 'completed', 'skipped'] as const
export type PhotoGroupStatus = (typeof PHOTO_GROUP_STATUSES)[number]

export function isPhotoGroupStatus(value: unknown): value is PhotoGroupStatus {
  return typeof value === 'string' && (PHOTO_GROUP_STATUSES as readonly string[]).includes(value)
}

/** Still ahead: the group has not been photographed and has not been passed over. */
export function isPending(status: PhotoGroupStatus): boolean {
  return status === 'queued' || status === 'get_ready'
}

/** Behind us: nothing further will happen to this group unless an organiser steps back. */
export function isFinished(status: PhotoGroupStatus): boolean {
  return status === 'completed' || status === 'skipped'
}

/**
 * The shape shared by the organiser's view and the guest's.
 *
 * Deliberately free of member ids: this is what travels over the wire to every phone at
 * the wedding, and a guest list that anyone can fetch is exactly what
 * `docs/SECURITY.md` §5 forbids.
 */
export type QueueGroup = {
  id: number
  name: string
  description: string | null
  /** Organiser's estimate, used for "about 10 minutes away". Null when not given. */
  estimatedMinutes: number | null
  order: number
  status: PhotoGroupStatus
}

/**
 * Everything a browser is given: the queue, and the revision it represents.
 *
 * A client applies a snapshot only when its revision is newer than the one it holds,
 * which makes a duplicated or out-of-order delivery harmless.
 */
export type QueueSnapshot = { revision: number; groups: QueueGroup[] }

/** The server-side record, which also knows who is in the group. */
export type PhotoGroup = QueueGroup & { memberIds: number[] }

/** Strips membership before a group is sent to a browser. */
export function toPublicGroup(group: PhotoGroup): QueueGroup {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    estimatedMinutes: group.estimatedMinutes,
    order: group.order,
    status: group.status,
  }
}

/**
 * The queue as it is worked through: by the organiser's ordering, with the record id as a
 * stable tie-break so two groups sharing an order never swap between renders.
 */
export function ordered<T extends QueueGroup>(groups: readonly T[]): T[] {
  return [...groups].sort((a, b) => a.order - b.order || a.id - b.id)
}

/* -------------------------------------------------------------------------- */
/* State machine                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Which status may follow which.
 *
 * `completed` and `skipped` are not terminal: the single most common thing to go wrong at
 * a wedding is a group being called before someone has arrived, so an organiser must
 * always be able to step back to a group they have already passed.
 */
const ALLOWED_TRANSITIONS: Record<PhotoGroupStatus, readonly PhotoGroupStatus[]> = {
  queued: ['get_ready', 'now', 'skipped'],
  get_ready: ['now', 'queued', 'skipped'],
  now: ['completed', 'skipped', 'get_ready', 'queued'],
  completed: ['now', 'queued'],
  skipped: ['queued', 'get_ready', 'now'],
}

/** A move to the same status is not a transition; callers treat it as a no-op. */
export function canTransition(from: PhotoGroupStatus, to: PhotoGroupStatus): boolean {
  return from !== to && ALLOWED_TRANSITIONS[from].includes(to)
}

export function allowedTransitions(from: PhotoGroupStatus): PhotoGroupStatus[] {
  return [...ALLOWED_TRANSITIONS[from]]
}

export type TransitionResult<T> = { ok: true; group: T } | { ok: false; reason: string }

/**
 * Applies a single status change, refusing anything the machine does not allow.
 *
 * The UI is built so an invalid transition cannot be requested, but the UI is not the
 * authority — this runs on the server for every write.
 */
export function transition<T extends QueueGroup>(
  group: T,
  to: PhotoGroupStatus,
): TransitionResult<T> {
  if (group.status === to) return { ok: false, reason: `${group.name} is already ${to}.` }
  if (!canTransition(group.status, to)) {
    return { ok: false, reason: `${group.name} cannot go from ${group.status} to ${to}.` }
  }
  return { ok: true, group: { ...group, status: to } }
}

/* -------------------------------------------------------------------------- */
/* Queue-level invariants                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Restores the two invariants the whole feature depends on: at most one group is `now`,
 * and the next pending group — and only that one — is `get_ready`.
 *
 * `get_ready` is derived rather than stored independently. Two organisers on two phones
 * both pressing Call Next is normal at a wedding, and deriving the flag means the worst
 * case is a duplicated advance rather than a queue with two "up next" cards.
 */
export function normalise<T extends QueueGroup>(groups: readonly T[]): T[] {
  const list = ordered(groups)
  const current = list.find((group) => group.status === 'now')
  const upNext = list.find((group) => isPending(group.status))

  return list.map((group) => {
    if (group.status === 'now') {
      // Keep only the first `now`; a second one is data we should not trust.
      return group === current ? group : { ...group, status: 'queued' as const }
    }
    if (!isPending(group.status)) return group

    const wanted: PhotoGroupStatus = group === upNext ? 'get_ready' : 'queued'
    return group.status === wanted ? group : { ...group, status: wanted }
  })
}

/** The group being photographed right now, if any. */
export function currentGroup<T extends QueueGroup>(groups: readonly T[]): T | null {
  return ordered(groups).find((group) => group.status === 'now') ?? null
}

/** The group that will be called next. */
export function upNextGroup<T extends QueueGroup>(groups: readonly T[]): T | null {
  return ordered(groups).find((group) => isPending(group.status)) ?? null
}

/**
 * The group an organiser means by "go back".
 *
 * The most recently passed group, read as the last finished one before the current
 * position. The queue is worked through in order, so order is a truer record of "last"
 * than a timestamp would be after an organiser has stepped back and forth.
 */
export function previousGroup<T extends QueueGroup>(groups: readonly T[]): T | null {
  const list = ordered(groups)
  const current = list.find((group) => group.status === 'now')
  const finished = list.filter((group) => isFinished(group.status))
  const before = current ? finished.filter((group) => group.order <= current.order) : finished

  return before.at(-1) ?? finished.at(-1) ?? null
}

export const QUEUE_ACTIONS = ['call-next', 'complete', 'skip', 'previous'] as const
export type QueueAction = (typeof QUEUE_ACTIONS)[number]

export function isQueueAction(value: unknown): value is QueueAction {
  return typeof value === 'string' && (QUEUE_ACTIONS as readonly string[]).includes(value)
}

/**
 * Applies one of the controller's four buttons, returning the new queue.
 *
 * Pure, so the wedding-day controller can be tested without a database and the browser
 * can show the result before the server confirms it.
 */
export function applyAction<T extends QueueGroup>(groups: readonly T[], action: QueueAction): T[] {
  const list = ordered(groups)
  const current = list.find((group) => group.status === 'now') ?? null
  const upNext = list.find((group) => isPending(group.status)) ?? null

  const replace = (changes: Map<number, PhotoGroupStatus>) =>
    normalise(
      list.map((group) => {
        const status = changes.get(group.id)
        return status ? { ...group, status } : group
      }),
    )

  switch (action) {
    case 'call-next': {
      const changes = new Map<number, PhotoGroupStatus>()
      if (current) changes.set(current.id, 'completed')
      if (upNext) changes.set(upNext.id, 'now')
      return replace(changes)
    }

    case 'complete': {
      // Stops rather than advancing: the photographer often pauses between groups, and
      // guessing that they want the next group up would call people over too early.
      if (!current) return list
      return replace(new Map([[current.id, 'completed']]))
    }

    case 'skip': {
      const changes = new Map<number, PhotoGroupStatus>()
      if (current) {
        // Someone is missing — pass over them and get on with the next group.
        changes.set(current.id, 'skipped')
        if (upNext) changes.set(upNext.id, 'now')
      } else if (upNext) {
        changes.set(upNext.id, 'skipped')
      } else {
        return list
      }
      return replace(changes)
    }

    case 'previous': {
      const target = previousGroup(list)
      if (!target) return list

      const changes = new Map<number, PhotoGroupStatus>([[target.id, 'now']])
      // The group that was up returns to the queue rather than being lost.
      if (current && current.id !== target.id) changes.set(current.id, 'queued')
      return replace(changes)
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Guest view                                                                 */
/* -------------------------------------------------------------------------- */

export type QueuePosition<T extends QueueGroup = QueueGroup> = {
  group: T
  /** 0 while being photographed, 1 when up next, n groups away otherwise. */
  groupsAway: number | null
  /** Rough wait from the organiser's own estimates. Null when none are set. */
  minutesAway: number | null
}

/**
 * How far away a group is.
 *
 * Returns null for a group that has already been photographed or passed over — there is
 * no distance to something behind you.
 */
export function positionOf<T extends QueueGroup>(
  groups: readonly T[],
  groupId: number,
): QueuePosition<T> | null {
  const list = ordered(groups)
  const group = list.find((candidate) => candidate.id === groupId)
  if (!group) return null

  if (isFinished(group.status)) return { group, groupsAway: null, minutesAway: null }
  if (group.status === 'now') return { group, groupsAway: 0, minutesAway: 0 }

  const pending = list.filter((candidate) => isPending(candidate.status))
  const index = pending.findIndex((candidate) => candidate.id === group.id)

  // The first pending group is one away, not zero: something is, or is about to be, in
  // front of it.
  const groupsAway = index + 1

  const ahead = [
    ...list.filter((candidate) => candidate.status === 'now'),
    ...pending.slice(0, index),
  ]
  const estimates = ahead.filter((candidate) => typeof candidate.estimatedMinutes === 'number')

  return {
    group,
    groupsAway,
    minutesAway:
      ahead.length === 0
        ? 0
        : estimates.length === 0
          ? null
          : estimates.reduce((total, candidate) => total + (candidate.estimatedMinutes ?? 0), 0),
  }
}

export type QueueSummary = {
  total: number
  completed: number
  skipped: number
  remaining: number
  /** True once nothing is pending and nothing is being photographed. */
  isFinished: boolean
}

export function summarise(groups: readonly QueueGroup[]): QueueSummary {
  const completed = groups.filter((group) => group.status === 'completed').length
  const skipped = groups.filter((group) => group.status === 'skipped').length
  const remaining = groups.filter((group) => isPending(group.status)).length

  return {
    total: groups.length,
    completed,
    skipped,
    remaining,
    isFinished:
      groups.length > 0 && remaining === 0 && !groups.some((group) => group.status === 'now'),
  }
}

export type GuestQueueView<T extends QueueGroup = QueueGroup> = {
  now: T | null
  upNext: T | null
  /** The guest's own groups, closest first, finished ones last. */
  yourGroups: QueuePosition<T>[]
  /** The one the screen leads with; null for a guest in no group. */
  nearest: QueuePosition<T> | null
  summary: QueueSummary
}

/**
 * Everything one guest's phone needs to render.
 *
 * Takes the guest's *group* ids rather than their guest ids so it can run in the browser
 * against the public snapshot: membership is resolved once on the server, and the list of
 * who is in a group never leaves it.
 */
export function buildGuestView<T extends QueueGroup>(
  groups: readonly T[],
  myGroupIds: readonly number[],
): GuestQueueView<T> {
  const list = ordered(groups)
  const mine = new Set(myGroupIds)

  const positions = list
    .filter((group) => mine.has(group.id))
    .map((group) => positionOf(list, group.id))
    .filter((position): position is QueuePosition<T> => position !== null)
    .sort((a, b) => {
      if (a.groupsAway === null && b.groupsAway === null) return a.group.order - b.group.order
      if (a.groupsAway === null) return 1
      if (b.groupsAway === null) return -1
      return a.groupsAway - b.groupsAway
    })

  return {
    now: currentGroup(list),
    upNext: upNextGroup(list),
    yourGroups: positions,
    nearest: positions.find((position) => position.groupsAway !== null) ?? null,
    summary: summarise(list),
  }
}

/**
 * The sentence under a guest's own group.
 *
 * The wording changes with distance on purpose (docs/UX.md §4.2): far away should feel
 * calm, "next" should get someone walking, and "now" should be unmistakable.
 */
export function describeDistance(position: QueuePosition): string {
  const { group, groupsAway, minutesAway } = position

  if (groupsAway === null) {
    return group.status === 'skipped' ? 'This group was passed over.' : 'This photo is done.'
  }
  if (groupsAway === 0) return 'You are being photographed now.'
  if (groupsAway === 1) return 'You are next. Start making your way over.'

  const distance = `You are ${groupsAway} groups away.`
  return minutesAway === null ? distance : `${distance} Roughly ${minutesAway} minutes.`
}

/* -------------------------------------------------------------------------- */
/* Ordering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Moves a group one place up or down, returning every group whose order changed.
 *
 * Returns the changes rather than the new list so the caller writes only what moved.
 */
export function reorder<T extends QueueGroup>(
  groups: readonly T[],
  groupId: number,
  direction: 'up' | 'down',
): { id: number; order: number }[] {
  const list = ordered(groups)
  const index = list.findIndex((group) => group.id === groupId)
  if (index === -1) return []

  const swapWith = direction === 'up' ? index - 1 : index + 1
  const a = list[index]
  const b = list[swapWith]
  if (!a || !b) return []

  // Rewriting every position rather than swapping the two stored values keeps the
  // sequence gapless, which matters because imported groups often share an order of 0.
  const next = [...list]
  next[index] = b
  next[swapWith] = a

  return next
    .map((group, position) => ({ id: group.id, order: position }))
    .filter((entry, position) => next[position]?.order !== position)
}
