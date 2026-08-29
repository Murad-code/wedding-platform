import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { toCsv, type GuestCsvRow } from '@/domain/guests/csv'
import {
  guestFiltersToWhere,
  PAGE_SIZE,
  SORT_ORDERS,
  type GuestFilters,
} from '@/domain/guests/filters'
import { guestDisplayName, type AgeGroup } from '@/domain/guests/guest'
import type { RsvpStatus } from '@/domain/rsvp/status'

export type GuestListRow = {
  id: number
  displayName: string
  firstName: string
  lastName: string | null
  partyId: number | null
  partyName: string
  ageGroup: AgeGroup
  rsvpStatus: RsvpStatus
  isPlusOne: boolean
  email: string | null
  dietaryRequirements: string | null
  allergies: string | null
  tagNames: string[]
}

export type GuestListPage = {
  rows: GuestListRow[]
  total: number
  page: number
  totalPages: number
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/** Payload returns a relationship as an id or a populated document, depending on depth. */
function relationName(value: unknown, key: string): { id: number | null; name: string } {
  if (value && typeof value === 'object') {
    const doc = value as Record<string, unknown>
    return {
      id: typeof doc.id === 'number' ? doc.id : null,
      name: text(doc[key]) ?? '',
    }
  }
  return { id: typeof value === 'number' ? value : null, name: '' }
}

export async function findGuests(filters: GuestFilters): Promise<GuestListPage> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'guests',
    where: guestFiltersToWhere(filters) as Where,
    sort: SORT_ORDERS[filters.sort],
    limit: PAGE_SIZE,
    page: filters.page,
    // depth 1 populates party and tags so the table can show names, not ids.
    depth: 1,
    overrideAccess: true,
  })

  return {
    rows: result.docs.map((doc) => {
      const party = relationName(doc.party, 'displayName')
      return {
        id: doc.id,
        firstName: doc.firstName,
        lastName: text(doc.lastName),
        displayName: guestDisplayName(doc.firstName, text(doc.lastName)),
        partyId: party.id,
        partyName: party.name,
        ageGroup: doc.ageGroup as AgeGroup,
        rsvpStatus: doc.rsvpStatus as RsvpStatus,
        isPlusOne: doc.isPlusOne === true,
        email: text(doc.email),
        dietaryRequirements: text(doc.dietaryRequirements),
        allergies: text(doc.allergies),
        tagNames: Array.isArray(doc.tags)
          ? doc.tags.map((tag) => relationName(tag, 'name').name).filter(Boolean)
          : [],
      }
    }),
    total: result.totalDocs,
    page: result.page ?? 1,
    totalPages: result.totalPages ?? 1,
  }
}

/**
 * Builds the guest-list CSV.
 *
 * Exports the *filtered* set, so "email everyone with a dietary requirement to the
 * caterer" is one filter and one download rather than a manual extraction.
 */
export async function exportGuestsCsv(filters: GuestFilters): Promise<string> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'guests',
    where: guestFiltersToWhere(filters) as Where,
    sort: SORT_ORDERS[filters.sort],
    // Export is a deliberate whole-set operation, unlike the paged table.
    limit: 5000,
    depth: 1,
    overrideAccess: true,
  })

  const rows: Record<keyof GuestCsvRow, string | null>[] = result.docs.map((doc) => ({
    party: relationName(doc.party, 'displayName').name,
    firstName: doc.firstName,
    lastName: text(doc.lastName),
    ageGroup: doc.ageGroup,
    email: text(doc.email),
    phone: text(doc.phone),
    rsvpStatus: doc.rsvpStatus,
    dietaryRequirements: text(doc.dietaryRequirements),
    allergies: text(doc.allergies),
    accessibilityNeeds: text(doc.accessibilityNeeds),
    notes: text(doc.internalNotes),
  }))

  return toCsv(rows)
}

export type ImportOutcome = {
  partiesCreated: number
  guestsCreated: number
  guestsSkipped: number
}

/**
 * Applies parsed CSV rows.
 *
 * Parties are matched by name and created on demand, because an organiser's spreadsheet
 * names households rather than referencing ids. Guests already present in a party are
 * skipped rather than duplicated, so re-importing a corrected file is safe — which is
 * what people actually do.
 */
export async function importGuests(rows: readonly GuestCsvRow[]): Promise<ImportOutcome> {
  const payload = await getPayload({ config })

  const outcome: ImportOutcome = { partiesCreated: 0, guestsCreated: 0, guestsSkipped: 0 }
  const partyIds = new Map<string, number>()

  for (const row of rows) {
    const key = row.party.toLowerCase()
    let partyId = partyIds.get(key)

    if (partyId === undefined) {
      const existing = await payload.find({
        collection: 'invitation-parties',
        where: { displayName: { equals: row.party } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (existing.docs[0]) {
        partyId = existing.docs[0].id
      } else {
        const created = await payload.create({
          collection: 'invitation-parties',
          overrideAccess: true,
          data: { displayName: row.party, status: 'pending', plusOnesAllowed: 0 },
        })
        partyId = created.id
        outcome.partiesCreated += 1
      }
      partyIds.set(key, partyId)
    }

    const duplicate = await payload.find({
      collection: 'guests',
      where: {
        and: [
          { party: { equals: partyId } },
          { firstName: { equals: row.firstName } },
          ...(row.lastName ? [{ lastName: { equals: row.lastName } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (duplicate.totalDocs > 0) {
      outcome.guestsSkipped += 1
      continue
    }

    await payload.create({
      collection: 'guests',
      overrideAccess: true,
      data: {
        party: partyId,
        firstName: row.firstName,
        lastName: row.lastName,
        ageGroup: row.ageGroup,
        rsvpStatus: row.rsvpStatus,
        email: row.email,
        phone: row.phone,
        dietaryRequirements: row.dietaryRequirements,
        allergies: row.allergies,
        accessibilityNeeds: row.accessibilityNeeds,
        internalNotes: row.notes,
      },
    })
    outcome.guestsCreated += 1
  }

  return outcome
}
