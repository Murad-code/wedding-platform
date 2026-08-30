import config from '@payload-config'
import { getPayload } from 'payload'

import { guestDisplayName } from '@/domain/guests/guest'
import { isTableShape, type SeatedGuest, type SeatingTable } from '@/domain/seating/seating'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function relationId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number') {
    return (value as { id: number }).id
  }
  return null
}

export async function getTables(): Promise<SeatingTable[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'tables',
    limit: 200,
    sort: 'order',
    depth: 0,
    overrideAccess: true,
  })

  return result.docs.map((table) => ({
    id: table.id,
    name: table.name,
    capacity: table.capacity,
    shape: isTableShape(table.shape) ? table.shape : 'round',
    notes: text(table.notes),
    order: table.order ?? 0,
  }))
}

/**
 * Guests who need a seat.
 *
 * Only attending guests: seating a decline would put a place card in front of an empty
 * chair, and pending guests would inflate every occupancy count with people who may
 * never come.
 */
export async function getSeatableGuests(): Promise<SeatedGuest[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'guests',
    where: { rsvpStatus: { equals: 'attending' } },
    limit: 2000,
    sort: 'lastName',
    depth: 1,
    overrideAccess: true,
  })

  return result.docs.map((guest) => ({
    id: guest.id,
    displayName: guestDisplayName(guest.firstName, text(guest.lastName)),
    partyName:
      guest.party && typeof guest.party === 'object' ? (guest.party.displayName ?? '') : '',
    tableId: relationId(guest.table),
  }))
}
