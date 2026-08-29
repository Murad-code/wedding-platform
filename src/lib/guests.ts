import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { type RsvpTotals } from '@/domain/rsvp/status'

export type DashboardTotals = RsvpTotals & {
  parties: number
  dietaryAlerts: number
}

/**
 * Headline dashboard numbers.
 *
 * Uses counting queries rather than loading guests and tallying in memory: the dashboard
 * only needs totals, and a wedding's guest list should never have to be fully
 * materialised to render a stat card.
 */
export async function getDashboardTotals(): Promise<DashboardTotals> {
  const payload = await getPayload({ config })

  const countGuests = async (where: Where) => {
    const result = await payload.count({ collection: 'guests', where, overrideAccess: true })
    return result.totalDocs
  }

  const [invited, attending, declined, pending, parties, withDiet, withAllergies] =
    await Promise.all([
      countGuests({}),
      countGuests({ rsvpStatus: { equals: 'attending' } }),
      countGuests({ rsvpStatus: { equals: 'declined' } }),
      countGuests({ rsvpStatus: { equals: 'pending' } }),
      payload
        .count({ collection: 'invitation-parties', overrideAccess: true })
        .then((r) => r.totalDocs),
      countGuests({ dietaryRequirements: { exists: true } }),
      countGuests({ allergies: { exists: true } }),
    ])

  return {
    invited,
    attending,
    declined,
    pending,
    parties,
    // Approximate: a guest with both counts once toward each, which overstates slightly.
    // The number exists to prompt a look at the detail, not to be authoritative.
    dietaryAlerts: Math.max(withDiet, withAllergies),
  }
}
