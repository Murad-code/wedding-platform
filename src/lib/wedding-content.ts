import config from '@payload-config'
import { getPayload } from 'payload'

import { guestVisibleContacts, type WeddingContact } from '@/domain/contacts/contact'
import {
  isItineraryVisibility,
  sortEntries,
  visibleTo,
  type Audience,
  type ItineraryEntry,
} from '@/domain/itinerary/item'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/**
 * Guest-facing content accessors.
 *
 * Visibility is applied here, on the server, rather than in a component. A guest page
 * never receives an internal itinerary item or a hidden contact's phone number in its
 * payload, so nothing sensitive is one "view source" away (docs/SECURITY.md §7).
 */
export async function getItinerary(audience: Audience): Promise<ItineraryEntry[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'itinerary-items',
    limit: 200,
    depth: 0,
    sort: 'order',
    overrideAccess: true,
  })

  const entries: ItineraryEntry[] = result.docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    description: text(doc.description),
    startTime: text(doc.startTime),
    endTime: text(doc.endTime),
    location: text(doc.location),
    visibility: isItineraryVisibility(doc.visibility) ? doc.visibility : 'internal',
    order: doc.order ?? 0,
  }))

  return sortEntries(visibleTo(entries, audience))
}

export async function getContacts(): Promise<WeddingContact[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'wedding-contacts',
    limit: 100,
    depth: 0,
    sort: 'order',
    overrideAccess: true,
  })

  return result.docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    role: text(doc.role),
    phone: text(doc.phone),
    whatsapp: text(doc.whatsapp),
    email: text(doc.email),
    visibleToGuests: doc.visibleToGuests === true,
    order: doc.order ?? 0,
  }))
}

/** Contacts a guest may see, already filtered and ordered. */
export async function getGuestContacts(): Promise<WeddingContact[]> {
  return guestVisibleContacts(await getContacts())
}
