import type { Payload } from 'payload'

import { toWeddingSettingsView } from '@/domain/wedding/settings'
import type { ItineraryItem, WeddingContact, WeddingSetting } from '@/payload-types'

type Collection = Parameters<Payload['find']>[0]['collection']

/** Finds a document matching `where`, or creates it from `data`. Never updates. */
export async function ensure(
  payload: Payload,
  collection: Collection,
  where: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ id: number }> {
  const existing = await payload.find({
    collection,
    where: where as never,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const found = existing.docs[0]
  if (found) return { id: found.id }

  const created = await payload.create({ collection, data: data as never, overrideAccess: true })
  return { id: created.id }
}

export const WEDDING_SETTINGS = {
  partnerOneName: 'Sarah',
  partnerTwoName: 'Adam',
  // 13:00Z is 2:00 pm BST, which the timezone E2E test asserts from a New York browser.
  weddingDate: '2027-06-12T13:00:00.000Z',
  timezone: 'Europe/London',
  rsvpDeadline: '2027-04-30T23:00:00.000Z',
  dressCode: 'Black tie, with comfortable shoes for the lawn.',
  welcomeMessage:
    'We would be so glad to have you with us as we say I do, somewhere green, with far too much cake.',
  ceremony: {
    venueName: 'Hedsor House',
    address: 'Hedsor Park\nTaplow\nBuckinghamshire SL1 8HX',
    mapUrl: 'https://maps.google.com/?q=Hedsor+House',
    startTime: '2027-06-12T13:00:00.000Z',
    notes: null,
  },
  reception: {
    venueName: 'The Orangery, Hedsor House',
    address: null,
    mapUrl: null,
    startTime: '2027-06-12T15:30:00.000Z',
    notes: 'Just across the lawn from the ceremony.',
  },
  travelInformation: 'Taplow station is fifteen minutes away by taxi, with trains from Paddington.',
  parkingInformation: 'There is plenty of parking on site, and cars may be left overnight.',
  accommodationInformation: 'We have held rooms at The Crown in Burnham until March.',
  faqs: [
    {
      question: 'Can we bring our children?',
      answer: 'Please do. There is a menu for them and a garden to run in.',
    },
    {
      question: 'Is the venue accessible?',
      answer:
        'Yes. The ceremony and reception are both step-free, and there is accessible parking by the entrance.',
    },
    {
      question: 'What time should we arrive?',
      answer: 'From half past twelve, so there is time for a drink before the ceremony.',
    },
  ],
  enabledFeatures: [
    'rsvp',
    'menu',
    'seating',
    'itinerary',
    'photoQueue',
    'accommodation',
    'travel',
    'faqs',
    'contacts',
  ],
} satisfies Omit<WeddingSetting, 'id'>

// One of each visibility, because the E2E suite proves internal and guests-only items stay hidden.
export const ITINERARY = [
  {
    title: 'Florist arrives',
    startTime: '2027-06-12T07:00:00.000Z',
    location: 'Service entrance',
    visibility: 'internal',
    order: 5,
  },
  {
    title: 'Guests arrive',
    startTime: '2027-06-12T11:30:00.000Z',
    location: 'The lawn',
    visibility: 'public',
    order: 10,
  },
  {
    title: 'Ceremony',
    startTime: '2027-06-12T12:00:00.000Z',
    location: 'The Great Hall',
    visibility: 'public',
    order: 20,
  },
  {
    title: 'Drinks reception',
    startTime: '2027-06-12T13:00:00.000Z',
    location: 'The terrace',
    visibility: 'public',
    order: 30,
  },
  {
    title: 'Wedding breakfast',
    startTime: '2027-06-12T14:30:00.000Z',
    location: 'The Orangery',
    visibility: 'public',
    order: 40,
  },
  {
    title: 'Speeches',
    startTime: '2027-06-12T17:00:00.000Z',
    location: null,
    visibility: 'guests',
    order: 50,
  },
  {
    title: 'First dance',
    startTime: '2027-06-12T19:00:00.000Z',
    location: null,
    visibility: 'public',
    order: 60,
  },
] satisfies Pick<ItineraryItem, 'title' | 'startTime' | 'location' | 'visibility' | 'order'>[]

export const CONTACTS = [
  {
    name: 'Priya Raman',
    role: 'Maid of Honour',
    phone: '+44 7700 900111',
    whatsapp: '+44 7700 900111',
    visibleToGuests: true,
    order: 10,
  },
  {
    name: 'Tom Whitfield',
    role: 'Best Man',
    phone: '+44 7700 900222',
    whatsapp: '+44 7700 900222',
    visibleToGuests: true,
    order: 20,
  },
  {
    name: 'Bloom & Vine',
    role: 'Florist',
    phone: '+44 7700 900999',
    whatsapp: '+44 7700 900999',
    visibleToGuests: false,
    order: 30,
  },
] satisfies Pick<
  WeddingContact,
  'name' | 'role' | 'phone' | 'whatsapp' | 'visibleToGuests' | 'order'
>[]

/**
 * Settings, itinerary, and contacts for the demo wedding.
 *
 * `overwriteSettings` is for the E2E suite, which asserts on this exact wedding; `pnpm seed`
 * leaves a wedding someone has already configured alone.
 */
export async function ensureWeddingBaseline(
  payload: Payload,
  { overwriteSettings }: { overwriteSettings: boolean },
): Promise<void> {
  const current = await payload.findGlobal({
    slug: 'wedding-settings',
    depth: 0,
    overrideAccess: true,
  })

  if (overwriteSettings || !toWeddingSettingsView(current).isConfigured) {
    await payload.updateGlobal({
      slug: 'wedding-settings',
      data: WEDDING_SETTINGS,
      overrideAccess: true,
    })
  }

  for (const item of ITINERARY) {
    await ensure(payload, 'itinerary-items', { title: { equals: item.title } }, item)
  }

  for (const contact of CONTACTS) {
    await ensure(payload, 'wedding-contacts', { name: { equals: contact.name } }, contact)
  }
}
