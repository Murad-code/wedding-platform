import type { GlobalConfig } from 'payload'

import { anyone, mutator } from '@/domain/auth/access'
import { FEATURES } from '@/domain/wedding/features'

/**
 * The one configuration record for this deployment (ADR-001).
 *
 * Everything client-specific lives here rather than in code, which is what makes this
 * repository reusable across weddings. Read it through `getWeddingSettings()` — never
 * import this global directly from a component.
 */
export const WeddingSettings: GlobalConfig = {
  slug: 'wedding-settings',
  access: {
    // The guest site is public, so the settings that drive it are publicly readable.
    // Fields that must not be public are marked and excluded by the domain accessor.
    read: anyone,
    update: mutator,
  },
  admin: {
    description: 'The wedding this deployment is for. Guests see most of this.',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'The wedding',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'partnerOneName',
                  type: 'text',
                  required: true,
                  admin: { width: '50%', description: 'First name shown on the website.' },
                },
                {
                  name: 'partnerTwoName',
                  type: 'text',
                  required: true,
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'weddingDate',
              type: 'date',
              required: true,
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'Entered in the wedding timezone below.',
              },
            },
            {
              name: 'timezone',
              type: 'text',
              required: true,
              defaultValue: 'Europe/London',
              admin: {
                description:
                  'IANA timezone, e.g. Europe/London. Guests abroad see the local ceremony time, not their own.',
              },
            },
            {
              name: 'rsvpDeadline',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'After this, guests can no longer change their RSVP.',
              },
            },
            {
              name: 'dressCode',
              type: 'text',
            },
            {
              name: 'welcomeMessage',
              type: 'textarea',
              admin: { description: 'The first thing guests read on the website.' },
            },
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
            },
          ],
        },
        {
          label: 'Ceremony & reception',
          fields: [
            {
              name: 'ceremony',
              type: 'group',
              fields: venueFields(),
            },
            {
              name: 'reception',
              type: 'group',
              fields: venueFields(),
            },
          ],
        },
        {
          label: 'Guest information',
          fields: [
            { name: 'travelInformation', type: 'textarea' },
            { name: 'parkingInformation', type: 'textarea' },
            { name: 'accommodationInformation', type: 'textarea' },
            {
              name: 'faqs',
              type: 'array',
              labels: { singular: 'Question', plural: 'Questions' },
              fields: [
                { name: 'question', type: 'text', required: true },
                { name: 'answer', type: 'textarea', required: true },
              ],
            },
          ],
        },
        {
          label: 'Features',
          fields: [
            {
              name: 'enabledFeatures',
              type: 'select',
              hasMany: true,
              defaultValue: FEATURES.filter((feature) => feature !== 'smsNotifications'),
              options: FEATURES.map((feature) => ({
                label: labelForFeature(feature),
                value: feature,
              })),
              admin: {
                description: 'Turning a feature off hides it from guests and from the dashboard.',
              },
            },
          ],
        },
      ],
    },
  ],
}

function venueFields() {
  return [
    { name: 'venueName', type: 'text' as const },
    { name: 'address', type: 'textarea' as const },
    {
      name: 'mapUrl',
      type: 'text' as const,
      admin: { description: 'Link to Google Maps or similar.' },
    },
    {
      name: 'startTime',
      type: 'date' as const,
      admin: { date: { pickerAppearance: 'dayAndTime' as const } },
    },
    { name: 'notes', type: 'textarea' as const },
  ]
}

function labelForFeature(feature: string): string {
  const labels: Record<string, string> = {
    rsvp: 'RSVP',
    menu: 'Menu & meal choices',
    seating: 'Seating planner',
    itinerary: 'Itinerary',
    photoQueue: 'Wedding-day photo queue',
    accommodation: 'Accommodation',
    travel: 'Travel',
    faqs: 'FAQs',
    contacts: 'Wedding contacts',
    smsNotifications: 'SMS notifications',
  }
  return labels[feature] ?? feature
}
