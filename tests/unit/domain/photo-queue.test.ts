import { describe, expect, it } from 'vitest'

import {
  applyAction,
  buildGuestView,
  canTransition,
  currentGroup,
  describeDistance,
  isPhotoGroupStatus,
  normalise,
  ordered,
  positionOf,
  previousGroup,
  reorder,
  summarise,
  toPublicGroup,
  transition,
  upNextGroup,
  type PhotoGroup,
  type PhotoGroupStatus,
  type QueueGroup,
} from '@/domain/photo-queue/queue'

function group(id: number, status: PhotoGroupStatus = 'queued', extra: Partial<QueueGroup> = {}) {
  return {
    id,
    name: `Group ${id}`,
    description: null,
    estimatedMinutes: null,
    order: id,
    status,
    ...extra,
  } satisfies QueueGroup
}

/** A queue mid-run: one done, one being photographed, two waiting. */
function running(): QueueGroup[] {
  return normalise([group(1, 'completed'), group(2, 'now'), group(3), group(4)])
}

describe('statuses', () => {
  it('recognises only the five known statuses', () => {
    expect(isPhotoGroupStatus('get_ready')).toBe(true)
    expect(isPhotoGroupStatus('paused')).toBe(false)
    expect(isPhotoGroupStatus(undefined)).toBe(false)
  })
})

describe('canTransition', () => {
  it('lets a waiting group be called', () => {
    expect(canTransition('queued', 'now')).toBe(true)
    expect(canTransition('get_ready', 'now')).toBe(true)
  })

  it('allows stepping back to a group already photographed', () => {
    // The commonest wedding-day mistake is calling a group before someone has arrived.
    expect(canTransition('completed', 'now')).toBe(true)
    expect(canTransition('skipped', 'now')).toBe(true)
  })

  it('refuses to finish a group that never started', () => {
    expect(canTransition('queued', 'completed')).toBe(false)
    expect(canTransition('completed', 'skipped')).toBe(false)
  })

  it('treats a move to the same status as no transition at all', () => {
    expect(canTransition('now', 'now')).toBe(false)
  })
})

describe('transition', () => {
  it('returns the changed group without mutating the original', () => {
    const before = group(1, 'get_ready')
    const result = transition(before, 'now')

    expect(result).toMatchObject({ ok: true, group: { status: 'now' } })
    expect(before.status).toBe('get_ready')
  })

  it('refuses an illegal move and says why', () => {
    const result = transition(group(1, 'queued'), 'completed')
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('cannot go from queued to completed')
  })

  it('refuses a repeat of the current status', () => {
    expect(transition(group(1, 'now'), 'now').ok).toBe(false)
  })
})

describe('normalise', () => {
  it('marks the first waiting group as up next', () => {
    const result = normalise([group(1, 'now'), group(2), group(3)])
    expect(result.map((g) => g.status)).toEqual(['now', 'get_ready', 'queued'])
  })

  it('keeps only one group being photographed', () => {
    // Two organisers on two phones can both press Call Next; the queue must not end up
    // with two groups on stage.
    const result = normalise([group(1, 'now'), group(2, 'now')])
    expect(result.filter((g) => g.status === 'now')).toHaveLength(1)
    expect(result[0]?.status).toBe('now')
  })

  it('demotes a stale get_ready that is no longer next', () => {
    const result = normalise([group(1), group(2, 'get_ready')])
    expect(result.map((g) => g.status)).toEqual(['get_ready', 'queued'])
  })

  it('flags the first group as up next before the queue has started', () => {
    expect(normalise([group(1), group(2)])[0]?.status).toBe('get_ready')
  })

  it('leaves a finished queue alone', () => {
    const result = normalise([group(1, 'completed'), group(2, 'skipped')])
    expect(result.map((g) => g.status)).toEqual(['completed', 'skipped'])
  })

  it('sorts by order, using the id to break ties', () => {
    const result = ordered([group(3, 'queued', { order: 0 }), group(1, 'queued', { order: 0 })])
    expect(result.map((g) => g.id)).toEqual([1, 3])
  })
})

describe('call next', () => {
  it('completes the current group and starts the next', () => {
    const result = applyAction(running(), 'call-next')
    expect(result.map((g) => g.status)).toEqual(['completed', 'completed', 'now', 'get_ready'])
  })

  it('starts the queue when nothing is being photographed yet', () => {
    const result = applyAction(normalise([group(1), group(2)]), 'call-next')
    expect(result.map((g) => g.status)).toEqual(['now', 'get_ready'])
  })

  it('completes the last group without starting anything', () => {
    const result = applyAction(normalise([group(1, 'completed'), group(2, 'now')]), 'call-next')
    expect(result.map((g) => g.status)).toEqual(['completed', 'completed'])
    expect(summarise(result).isFinished).toBe(true)
  })

  it('does nothing to an empty queue', () => {
    expect(applyAction([], 'call-next')).toEqual([])
  })
})

describe('complete', () => {
  it('ends the current group without calling the next one over', () => {
    // The photographer often pauses between groups; advancing here would summon people
    // to stand around waiting.
    const result = applyAction(running(), 'complete')
    expect(result.map((g) => g.status)).toEqual(['completed', 'completed', 'get_ready', 'queued'])
  })

  it('is a no-op when no group is being photographed', () => {
    const before = normalise([group(1), group(2)])
    expect(applyAction(before, 'complete')).toEqual(before)
  })
})

describe('skip', () => {
  it('passes over the current group and moves straight on', () => {
    const result = applyAction(running(), 'skip')
    expect(result.map((g) => g.status)).toEqual(['completed', 'skipped', 'now', 'get_ready'])
  })

  it('passes over a group that has not started, without starting anything', () => {
    const result = applyAction(normalise([group(1), group(2)]), 'skip')
    expect(result.map((g) => g.status)).toEqual(['skipped', 'get_ready'])
  })

  it('does nothing when there is nothing left to skip', () => {
    const before = normalise([group(1, 'completed')])
    expect(applyAction(before, 'skip')).toEqual(before)
  })
})

describe('previous', () => {
  it('brings back the group just photographed and re-queues the current one', () => {
    const result = applyAction(running(), 'previous')
    expect(result.map((g) => g.status)).toEqual(['now', 'get_ready', 'queued', 'queued'])
  })

  it('can step back into a group that was skipped', () => {
    const before = normalise([group(1, 'skipped'), group(2, 'now'), group(3)])
    expect(applyAction(before, 'previous').map((g) => g.status)).toEqual([
      'now',
      'get_ready',
      'queued',
    ])
  })

  it('reopens the last finished group when the queue has ended', () => {
    const before = normalise([group(1, 'completed'), group(2, 'completed')])
    expect(applyAction(before, 'previous').map((g) => g.status)).toEqual(['completed', 'now'])
  })

  it('does nothing before anything has been photographed', () => {
    const before = normalise([group(1), group(2)])
    expect(applyAction(before, 'previous')).toEqual(before)
    expect(previousGroup(before)).toBeNull()
  })

  it('undoes a call-next exactly', () => {
    const before = running()
    const round = applyAction(applyAction(before, 'call-next'), 'previous')
    expect(round.map((g) => g.status)).toEqual(before.map((g) => g.status))
  })
})

describe('current and up next', () => {
  it('reads the queue', () => {
    const queue = running()
    expect(currentGroup(queue)?.id).toBe(2)
    expect(upNextGroup(queue)?.id).toBe(3)
  })

  it('has no current group before the queue starts', () => {
    const queue = normalise([group(1), group(2)])
    expect(currentGroup(queue)).toBeNull()
    expect(upNextGroup(queue)?.id).toBe(1)
  })
})

describe('positionOf', () => {
  it('puts the group being photographed at zero', () => {
    expect(positionOf(running(), 2)?.groupsAway).toBe(0)
  })

  it('counts the group up next as one away', () => {
    expect(positionOf(running(), 3)?.groupsAway).toBe(1)
  })

  it('counts further groups by how many wait in front', () => {
    expect(positionOf(running(), 4)?.groupsAway).toBe(2)
  })

  it('gives no distance to a group already photographed', () => {
    expect(positionOf(running(), 1)?.groupsAway).toBeNull()
  })

  it('returns null for a group that does not exist', () => {
    expect(positionOf(running(), 99)).toBeNull()
  })

  it('adds up the estimates of the groups in front', () => {
    const queue = normalise([
      group(1, 'now', { estimatedMinutes: 5 }),
      group(2, 'queued', { estimatedMinutes: 10 }),
      group(3, 'queued', { estimatedMinutes: 4 }),
    ])
    expect(positionOf(queue, 3)?.minutesAway).toBe(15)
  })

  it('offers no estimate when the organiser has given none', () => {
    expect(positionOf(running(), 4)?.minutesAway).toBeNull()
  })

  it('ignores groups already done when estimating the wait', () => {
    const queue = normalise([
      group(1, 'completed', { estimatedMinutes: 30 }),
      group(2, 'now', { estimatedMinutes: 5 }),
      group(3, 'queued', { estimatedMinutes: 4 }),
    ])
    expect(positionOf(queue, 3)?.minutesAway).toBe(5)
  })
})

describe('summarise', () => {
  it('counts progress through the queue', () => {
    expect(summarise(running())).toMatchObject({
      total: 4,
      completed: 1,
      skipped: 0,
      remaining: 2,
      isFinished: false,
    })
  })

  it('is finished only when nothing is pending and nothing is on stage', () => {
    expect(summarise(normalise([group(1, 'completed'), group(2, 'skipped')])).isFinished).toBe(true)
    expect(summarise(normalise([group(1, 'now')])).isFinished).toBe(false)
  })

  it('is not finished when there are no groups at all', () => {
    expect(summarise([]).isFinished).toBe(false)
  })
})

describe('buildGuestView', () => {
  it('shows now and up next to a guest in no group', () => {
    const view = buildGuestView(running(), [])
    expect(view.now?.id).toBe(2)
    expect(view.upNext?.id).toBe(3)
    expect(view.yourGroups).toEqual([])
    expect(view.nearest).toBeNull()
  })

  it('orders a guest’s own groups by how close they are', () => {
    const view = buildGuestView(running(), [4, 3])
    expect(view.yourGroups.map((p) => p.group.id)).toEqual([3, 4])
    expect(view.nearest?.group.id).toBe(3)
  })

  it('keeps a finished group visible but never treats it as the nearest', () => {
    const view = buildGuestView(running(), [1, 4])
    expect(view.yourGroups.map((p) => p.group.id)).toEqual([4, 1])
    expect(view.nearest?.group.id).toBe(4)
  })

  it('ignores a group id the guest is not really in', () => {
    expect(buildGuestView(running(), [99]).yourGroups).toEqual([])
  })
})

describe('describeDistance', () => {
  const view = buildGuestView(running(), [1, 2, 3, 4])
  const at = (id: number) => {
    const position = view.yourGroups.find((p) => p.group.id === id)
    if (!position) throw new Error(`no position for ${id}`)
    return describeDistance(position)
  }

  it('is unmistakable when the guest is up', () => {
    expect(at(2)).toBe('You are being photographed now.')
  })

  it('gets the next group walking', () => {
    expect(at(3)).toBe('You are next. Start making your way over.')
  })

  it('stays calm at a distance', () => {
    expect(at(4)).toBe('You are 2 groups away.')
  })

  it('adds a rough wait when the organiser has estimated one', () => {
    const queue = normalise([
      group(1, 'now', { estimatedMinutes: 6 }),
      group(2, 'queued', { estimatedMinutes: 4 }),
      group(3),
    ])
    const position = positionOf(queue, 3)
    expect(position && describeDistance(position)).toBe(
      'You are 2 groups away. Roughly 10 minutes.',
    )
  })

  it('says a group is done rather than showing a distance', () => {
    expect(at(1)).toBe('This photo is done.')
  })

  it('distinguishes a group that was passed over', () => {
    const queue = normalise([group(1, 'skipped')])
    const position = positionOf(queue, 1)
    expect(position && describeDistance(position)).toBe('This group was passed over.')
  })
})

describe('toPublicGroup', () => {
  it('drops the member list before the group is broadcast', () => {
    // Every phone at the wedding receives this. A group that carried its members would
    // be a guest directory available to anyone who opened the page.
    const full: PhotoGroup = { ...group(1), memberIds: [7, 8, 9] }
    const published = toPublicGroup(full)

    expect(published).not.toHaveProperty('memberIds')
    expect(JSON.stringify(published)).not.toContain('7')
    expect(published.name).toBe('Group 1')
  })
})

describe('reorder', () => {
  const queue = [
    group(1, 'queued', { order: 0 }),
    group(2, 'queued', { order: 1 }),
    group(3, 'queued', { order: 2 }),
  ]

  it('moves a group up, returning only what changed', () => {
    expect(reorder(queue, 2, 'up')).toEqual([
      { id: 2, order: 0 },
      { id: 1, order: 1 },
    ])
  })

  it('moves a group down', () => {
    expect(reorder(queue, 2, 'down')).toEqual([
      { id: 3, order: 1 },
      { id: 2, order: 2 },
    ])
  })

  it('refuses to move the first group up or the last one down', () => {
    expect(reorder(queue, 1, 'up')).toEqual([])
    expect(reorder(queue, 3, 'down')).toEqual([])
  })

  it('gives every group a gapless position when orders collide', () => {
    const collided = [
      group(1, 'queued', { order: 0 }),
      group(2, 'queued', { order: 0 }),
      group(3, 'queued', { order: 0 }),
    ]
    expect(reorder(collided, 3, 'up')).toEqual([
      { id: 3, order: 1 },
      { id: 2, order: 2 },
    ])
  })

  it('ignores an unknown group', () => {
    expect(reorder(queue, 99, 'up')).toEqual([])
  })
})
