/**
 * Seating.
 *
 * Capacity is **advisory**. An organiser who wants a ninth chair at an eight-person table
 * is not making a mistake the software should refuse — they know their venue. So every
 * rule here warns and none of them block (docs/UX.md §3.3).
 */

export const TABLE_SHAPES = ['round', 'rectangle', 'head'] as const
export type TableShape = (typeof TABLE_SHAPES)[number]

export function isTableShape(value: unknown): value is TableShape {
  return typeof value === 'string' && (TABLE_SHAPES as readonly string[]).includes(value)
}

export type SeatingTable = {
  id: number
  name: string
  capacity: number
  shape: TableShape
  notes: string | null
  order: number
}

export type SeatedGuest = {
  id: number
  displayName: string
  partyName: string
  /** null means unassigned — the state the planner exists to eliminate. */
  tableId: number | null
}

export type TableOccupancy = {
  table: SeatingTable
  guests: SeatedGuest[]
  seated: number
  capacity: number
  /** Negative when over capacity. */
  remaining: number
  isOverCapacity: boolean
  isFull: boolean
}

export function occupancyFor(table: SeatingTable, guests: readonly SeatedGuest[]): TableOccupancy {
  const seated = guests.filter((guest) => guest.tableId === table.id)

  return {
    table,
    guests: [...seated].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    seated: seated.length,
    capacity: table.capacity,
    remaining: table.capacity - seated.length,
    isOverCapacity: seated.length > table.capacity,
    isFull: seated.length === table.capacity,
  }
}

export function buildPlan(
  tables: readonly SeatingTable[],
  guests: readonly SeatedGuest[],
): TableOccupancy[] {
  return [...tables]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((table) => occupancyFor(table, guests))
}

/** Guests with nowhere to sit. This is the number an organiser is trying to get to zero. */
export function unassignedGuests(guests: readonly SeatedGuest[]): SeatedGuest[] {
  return guests
    .filter((guest) => guest.tableId === null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export type SeatingSummary = {
  totalGuests: number
  seated: number
  unassigned: number
  tables: number
  totalCapacity: number
  overCapacityTables: string[]
  /** True when everyone has a seat — the planner's definition of done. */
  isComplete: boolean
}

export function summarise(
  tables: readonly SeatingTable[],
  guests: readonly SeatedGuest[],
): SeatingSummary {
  const plan = buildPlan(tables, guests)
  const unassigned = unassignedGuests(guests).length

  return {
    totalGuests: guests.length,
    seated: guests.length - unassigned,
    unassigned,
    tables: tables.length,
    totalCapacity: tables.reduce((total, table) => total + table.capacity, 0),
    overCapacityTables: plan
      .filter((occupancy) => occupancy.isOverCapacity)
      .map((occupancy) => occupancy.table.name),
    isComplete: guests.length > 0 && unassigned === 0,
  }
}

export type SeatingWarning =
  | { kind: 'over-capacity'; tableName: string; seated: number; capacity: number }
  | { kind: 'not-enough-seats'; guests: number; capacity: number }
  | { kind: 'unassigned'; count: number }

/**
 * Everything worth telling the organiser, worst first.
 *
 * "There are more guests than seats" is listed before individual over-capacity tables,
 * because no amount of rearranging fixes it — the couple needs another table.
 */
export function warningsFor(
  tables: readonly SeatingTable[],
  guests: readonly SeatedGuest[],
): SeatingWarning[] {
  const summary = summarise(tables, guests)
  const warnings: SeatingWarning[] = []

  if (tables.length > 0 && guests.length > summary.totalCapacity) {
    warnings.push({
      kind: 'not-enough-seats',
      guests: guests.length,
      capacity: summary.totalCapacity,
    })
  }

  for (const occupancy of buildPlan(tables, guests)) {
    if (occupancy.isOverCapacity) {
      warnings.push({
        kind: 'over-capacity',
        tableName: occupancy.table.name,
        seated: occupancy.seated,
        capacity: occupancy.capacity,
      })
    }
  }

  if (summary.unassigned > 0) {
    warnings.push({ kind: 'unassigned', count: summary.unassigned })
  }

  return warnings
}

/**
 * Applies a move, returning the new guest list.
 *
 * Pure, so the planner can show the result optimistically before the server confirms and
 * the move semantics can be tested without a database. Moving a guest to the table they
 * already occupy is a no-op rather than an error — a drag that lands where it started is
 * not a failure.
 */
export function assignGuest(
  guests: readonly SeatedGuest[],
  guestId: number,
  tableId: number | null,
): SeatedGuest[] {
  return guests.map((guest) => (guest.id === guestId ? { ...guest, tableId } : guest))
}

/**
 * A human sentence describing a move, for the planner's live region.
 *
 * Drag-and-drop is invisible to a screen reader unless the outcome is announced, so this
 * is not decoration (docs/UX.md §7).
 */
export function describeMove(
  guestName: string,
  toTable: SeatingTable | null,
  occupancy?: TableOccupancy,
): string {
  if (!toTable) return `${guestName} moved to unassigned.`

  const base = `${guestName} seated at ${toTable.name}.`
  if (!occupancy) return base

  if (occupancy.isOverCapacity) {
    return `${base} ${toTable.name} is now over capacity, with ${occupancy.seated} of ${occupancy.capacity} seats taken.`
  }
  return `${base} ${occupancy.seated} of ${occupancy.capacity} seats taken.`
}
