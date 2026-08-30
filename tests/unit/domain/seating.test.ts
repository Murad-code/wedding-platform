import { describe, expect, it } from 'vitest'

import {
  assignGuest,
  buildPlan,
  describeMove,
  isTableShape,
  occupancyFor,
  summarise,
  unassignedGuests,
  warningsFor,
  type SeatedGuest,
  type SeatingTable,
} from '@/domain/seating/seating'

function table(partial: Partial<SeatingTable> & { id: number }): SeatingTable {
  return {
    name: `Table ${partial.id}`,
    capacity: 8,
    shape: 'round',
    notes: null,
    order: partial.id,
    ...partial,
  }
}

function guest(id: number, tableId: number | null, displayName = `Guest ${id}`): SeatedGuest {
  return { id, displayName, partyName: 'A party', tableId }
}

describe('isTableShape', () => {
  it('accepts known shapes and rejects anything else', () => {
    expect(isTableShape('round')).toBe(true)
    expect(isTableShape('head')).toBe(true)
    expect(isTableShape('hexagonal')).toBe(false)
    expect(isTableShape(null)).toBe(false)
  })
})

describe('occupancyFor', () => {
  const one = table({ id: 1, capacity: 3 })

  it('counts only the guests at that table', () => {
    const occupancy = occupancyFor(one, [guest(1, 1), guest(2, 2), guest(3, null)])
    expect(occupancy.seated).toBe(1)
    expect(occupancy.remaining).toBe(2)
  })

  it('reports a full table without calling it over capacity', () => {
    const occupancy = occupancyFor(one, [guest(1, 1), guest(2, 1), guest(3, 1)])
    expect(occupancy.isFull).toBe(true)
    expect(occupancy.isOverCapacity).toBe(false)
    expect(occupancy.remaining).toBe(0)
  })

  it('allows over capacity and reports it, rather than refusing', () => {
    // Organisers legitimately squeeze in a chair; the software warns, it does not block.
    const occupancy = occupancyFor(one, [guest(1, 1), guest(2, 1), guest(3, 1), guest(4, 1)])
    expect(occupancy.isOverCapacity).toBe(true)
    expect(occupancy.seated).toBe(4)
    expect(occupancy.remaining).toBe(-1)
  })

  it('sorts seated guests by name so a table card reads predictably', () => {
    const occupancy = occupancyFor(one, [guest(1, 1, 'Zoe'), guest(2, 1, 'Adam')])
    expect(occupancy.guests.map((g) => g.displayName)).toEqual(['Adam', 'Zoe'])
  })

  it('handles a table with nobody at it', () => {
    expect(occupancyFor(one, []).seated).toBe(0)
  })
})

describe('buildPlan', () => {
  it('orders tables by their order field, then name', () => {
    const plan = buildPlan([table({ id: 2, order: 1 }), table({ id: 1, order: 0 })], [])
    expect(plan.map((o) => o.table.id)).toEqual([1, 2])
  })

  it('returns an empty plan when there are no tables', () => {
    expect(buildPlan([], [guest(1, null)])).toEqual([])
  })
})

describe('unassignedGuests', () => {
  it('finds guests with no table, sorted by name', () => {
    const result = unassignedGuests([guest(1, 1), guest(2, null, 'Zoe'), guest(3, null, 'Adam')])
    expect(result.map((g) => g.displayName)).toEqual(['Adam', 'Zoe'])
  })

  it('is empty once everyone is seated', () => {
    expect(unassignedGuests([guest(1, 1), guest(2, 2)])).toEqual([])
  })
})

describe('summarise', () => {
  const tables = [table({ id: 1, capacity: 2 }), table({ id: 2, capacity: 2 })]

  it('counts seated and unassigned', () => {
    const summary = summarise(tables, [guest(1, 1), guest(2, null), guest(3, null)])
    expect(summary).toMatchObject({ totalGuests: 3, seated: 1, unassigned: 2, totalCapacity: 4 })
  })

  it('is complete only when everyone has a seat', () => {
    expect(summarise(tables, [guest(1, 1), guest(2, 2)]).isComplete).toBe(true)
    expect(summarise(tables, [guest(1, 1), guest(2, null)]).isComplete).toBe(false)
  })

  it('is not complete with no guests at all — there is nothing to be done yet', () => {
    expect(summarise(tables, []).isComplete).toBe(false)
  })

  it('names the tables that are over capacity', () => {
    const summary = summarise(
      [table({ id: 1, capacity: 1, name: 'Top table' })],
      [guest(1, 1), guest(2, 1)],
    )
    expect(summary.overCapacityTables).toEqual(['Top table'])
  })
})

describe('warningsFor', () => {
  it('says nothing when the plan is sound', () => {
    expect(warningsFor([table({ id: 1, capacity: 2 })], [guest(1, 1), guest(2, 1)])).toEqual([])
  })

  it('leads with "not enough seats", which rearranging cannot fix', () => {
    const warnings = warningsFor(
      [table({ id: 1, capacity: 1 })],
      [guest(1, 1), guest(2, 1), guest(3, null)],
    )
    expect(warnings[0]).toMatchObject({ kind: 'not-enough-seats', guests: 3, capacity: 1 })
  })

  it('reports each over-capacity table with its numbers', () => {
    const warnings = warningsFor(
      [table({ id: 1, capacity: 1, name: 'Table one' }), table({ id: 2, capacity: 10 })],
      [guest(1, 1), guest(2, 1)],
    )
    expect(warnings).toContainEqual({
      kind: 'over-capacity',
      tableName: 'Table one',
      seated: 2,
      capacity: 1,
    })
  })

  it('reports unassigned guests', () => {
    const warnings = warningsFor([table({ id: 1, capacity: 10 })], [guest(1, null)])
    expect(warnings).toContainEqual({ kind: 'unassigned', count: 1 })
  })

  it('does not warn about capacity before any tables exist', () => {
    // A wedding that has not started seating yet is not "short of seats".
    expect(warningsFor([], [guest(1, null)]).some((w) => w.kind === 'not-enough-seats')).toBe(false)
  })
})

describe('assignGuest', () => {
  const guests = [guest(1, null), guest(2, 1)]

  it('seats an unassigned guest', () => {
    expect(assignGuest(guests, 1, 2).find((g) => g.id === 1)?.tableId).toBe(2)
  })

  it('moves a guest between tables', () => {
    expect(assignGuest(guests, 2, 3).find((g) => g.id === 2)?.tableId).toBe(3)
  })

  it('unassigns a guest', () => {
    expect(assignGuest(guests, 2, null).find((g) => g.id === 2)?.tableId).toBeNull()
  })

  it('treats a move to the same table as a no-op, not an error', () => {
    // A drag that lands where it started is not a failure.
    expect(assignGuest(guests, 2, 1)).toEqual(guests)
  })

  it('leaves other guests alone', () => {
    expect(assignGuest(guests, 1, 2).find((g) => g.id === 2)?.tableId).toBe(1)
  })

  it('does not mutate its input', () => {
    assignGuest(guests, 1, 2)
    expect(guests[0]?.tableId).toBeNull()
  })

  it('ignores an unknown guest', () => {
    expect(assignGuest(guests, 999, 1)).toEqual(guests)
  })
})

describe('describeMove', () => {
  const top = table({ id: 1, capacity: 2, name: 'Top table' })

  it('announces an unassignment', () => {
    expect(describeMove('Ada Kamali', null)).toBe('Ada Kamali moved to unassigned.')
  })

  it('announces a seating with the occupancy', () => {
    const occupancy = occupancyFor(top, [guest(1, 1)])
    expect(describeMove('Ada Kamali', top, occupancy)).toBe(
      'Ada Kamali seated at Top table. 1 of 2 seats taken.',
    )
  })

  it('says so when the move pushes a table over capacity', () => {
    // Drag-and-drop is invisible to a screen reader unless the outcome is announced.
    const occupancy = occupancyFor(top, [guest(1, 1), guest(2, 1), guest(3, 1)])
    expect(describeMove('Ada Kamali', top, occupancy)).toContain('over capacity')
    expect(describeMove('Ada Kamali', top, occupancy)).toContain('3 of 2')
  })

  it('still announces the move without occupancy detail', () => {
    expect(describeMove('Ada Kamali', top)).toBe('Ada Kamali seated at Top table.')
  })
})
