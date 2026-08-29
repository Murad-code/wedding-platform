import type { CollectionConfig } from 'payload'

import { authenticated, mutator } from '@/domain/auth/access'

/**
 * The wedding-day timeline.
 *
 * Read access is restricted to organisers. The guest site reads through a server-side
 * accessor that filters by visibility, so internal supplier timings never reach a browser
 * (see `src/domain/itinerary/item.ts`).
 */
export const ItineraryItems: CollectionConfig = {
  slug: 'itinerary-items',
  access: {
    read: authenticated,
    create: mutator,
    update: mutator,
    delete: mutator,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['order', 'title', 'startTime', 'visibility'],
    description: 'The order of the day.',
  },
  defaultSort: 'order',
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      index: true,
      admin: { description: 'Lower numbers appear first.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startTime',
          type: 'date',
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'endTime',
          type: 'date',
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },
    { name: 'location', type: 'text' },
    { name: 'description', type: 'textarea', maxLength: 1000 },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'guests',
      options: [
        { label: 'Everyone (public site)', value: 'public' },
        { label: 'Invited guests', value: 'guests' },
        { label: 'Internal only', value: 'internal' },
      ],
      admin: {
        description: 'Internal items are for your own planning and are never shown to guests.',
      },
    },
  ],
  timestamps: true,
}
