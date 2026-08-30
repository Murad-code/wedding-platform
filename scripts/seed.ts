import 'dotenv/config'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

/**
 * Deterministic development data for the demo wedding.
 *
 * Idempotent: everything is keyed on a stable name, so running it twice changes nothing
 * and running it after a partial wipe restores what is missing. That matters because a
 * development database is regularly emptied by hand or by a failed test run, and there
 * is otherwise no way back to a coherent demo.
 *
 *   pnpm seed
 */

/**
 * Refuses to run against production.
 *
 * A seed that invented guests in a real couple's wedding would be a data incident, so
 * this is a hard stop rather than a warning (docs/SECURITY.md §11).
 */
function assertNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed data must never be written to a production deployment.')
    process.exit(1)
  }
}

/** Finds a document by a unique-ish field, or creates it. Never updates. */
async function ensure(
  payload: Payload,
  collection: Parameters<Payload['find']>[0]['collection'],
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

  const created = await payload.create({
    collection,
    data: data as never,
    overrideAccess: true,
  })

  return { id: created.id }
}

type SeedGuest = {
  firstName: string
  lastName: string
  rsvpStatus: 'pending' | 'attending' | 'declined'
  ageGroup?: 'adult' | 'child' | 'infant'
  isPlusOne?: boolean
  dietaryRequirements?: string
  allergies?: string
  accessibilityNeeds?: string
  email?: string
}

/**
 * A guest list shaped to exercise the dashboard rather than to look tidy: every RSVP
 * state, an unnamed plus-one, children, and the dietary, allergy, and accessibility
 * cases the caterer export and the alerts panel exist for.
 */
const PARTIES: { name: string; plusOnesAllowed?: number; guests: SeedGuest[] }[] = [
  {
    name: 'The Kamali Family',
    guests: [
      {
        firstName: 'Murad',
        lastName: 'Kamali',
        rsvpStatus: 'attending',
        email: 'murad@example.test',
      },
      {
        firstName: 'Priya',
        lastName: 'Kamali',
        rsvpStatus: 'attending',
        dietaryRequirements: 'Vegetarian',
      },
      { firstName: 'Ada', lastName: 'Kamali', rsvpStatus: 'attending', ageGroup: 'child' },
    ],
  },
  {
    name: 'Ellen Whitfield',
    plusOnesAllowed: 1,
    guests: [
      {
        firstName: 'Ellen',
        lastName: 'Whitfield',
        rsvpStatus: 'attending',
        accessibilityNeeds: 'Step-free access to the ceremony and a seat near the front',
      },
      { firstName: 'Guest', lastName: 'of Ellen', rsvpStatus: 'pending', isPlusOne: true },
    ],
  },
  {
    name: 'Tom & Jo Whitfield',
    guests: [
      { firstName: 'Tom', lastName: 'Whitfield', rsvpStatus: 'attending' },
      {
        firstName: 'Jo',
        lastName: 'Whitfield',
        rsvpStatus: 'attending',
        allergies: 'Severe nut allergy',
      },
    ],
  },
  {
    name: 'John & Amy Doyle',
    guests: [
      { firstName: 'John', lastName: 'Doyle', rsvpStatus: 'declined' },
      { firstName: 'Amy', lastName: 'Doyle', rsvpStatus: 'declined' },
    ],
  },
  {
    name: 'The Osei Family',
    guests: [
      { firstName: 'Kwame', lastName: 'Osei', rsvpStatus: 'pending' },
      { firstName: 'Abena', lastName: 'Osei', rsvpStatus: 'pending' },
      { firstName: 'Kofi', lastName: 'Osei', rsvpStatus: 'pending', ageGroup: 'child' },
      { firstName: 'Esi', lastName: 'Osei', rsvpStatus: 'pending', ageGroup: 'infant' },
    ],
  },
  {
    name: 'The Bianchi Family',
    guests: [
      {
        firstName: 'Luca',
        lastName: 'Bianchi',
        rsvpStatus: 'attending',
        dietaryRequirements: 'Coeliac, gluten-free',
      },
      { firstName: 'Sofia', lastName: 'Bianchi', rsvpStatus: 'attending' },
      { firstName: 'Marco', lastName: 'Bianchi', rsvpStatus: 'declined' },
    ],
  },
]

/** Named so the photographer can read them out; membership is resolved by surname. */
const PHOTO_GROUPS: { name: string; description?: string; minutes: number; surnames: string[] }[] =
  [
    { name: 'The couple', description: 'By the lake', minutes: 6, surnames: [] },
    {
      name: 'Kamali family',
      description: 'On the terrace steps',
      minutes: 8,
      surnames: ['Kamali'],
    },
    { name: 'Whitfield family', minutes: 8, surnames: ['Whitfield'] },
    { name: 'Bianchi family', minutes: 6, surnames: ['Bianchi'] },
    { name: 'Everyone', description: 'On the lawn', minutes: 12, surnames: ['*'] },
  ]

async function main() {
  assertNotProduction()

  const payload = await getPayload({ config })

  for (const party of PARTIES) {
    const created = await ensure(
      payload,
      'invitation-parties',
      { displayName: { equals: party.name } },
      {
        displayName: party.name,
        status: 'pending',
        plusOnesAllowed: party.plusOnesAllowed ?? 0,
      },
    )

    for (const guest of party.guests) {
      await ensure(
        payload,
        'guests',
        {
          and: [
            { firstName: { equals: guest.firstName } },
            { lastName: { equals: guest.lastName } },
          ],
        },
        {
          ...guest,
          ageGroup: guest.ageGroup ?? 'adult',
          party: created.id,
        },
      )
    }
  }

  const attending = await payload.find({
    collection: 'guests',
    where: { rsvpStatus: { equals: 'attending' } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  for (const [order, group] of PHOTO_GROUPS.entries()) {
    const members = attending.docs
      .filter(
        (guest) =>
          group.surnames.includes('*') ||
          group.surnames.includes(typeof guest.lastName === 'string' ? guest.lastName : ''),
      )
      .map((guest) => guest.id)

    await ensure(
      payload,
      'photo-groups',
      { name: { equals: group.name } },
      {
        name: group.name,
        description: group.description ?? null,
        estimatedMinutes: group.minutes,
        order,
        status: 'queued',
        members,
      },
    )
  }

  const counts = await Promise.all(
    (['invitation-parties', 'guests', 'photo-groups'] as const).map(async (collection) => {
      const result = await payload.count({ collection, overrideAccess: true })
      return `${collection}: ${result.totalDocs}`
    }),
  )

  console.log(`Seeded development data. ${counts.join(', ')}.`)
  process.exit(0)
}

main().catch((error) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
