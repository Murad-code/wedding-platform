import type { CollectionConfig } from 'payload'

import { authenticated, mutator } from '@/domain/auth/access'
import { TABLE_SHAPES } from '@/domain/seating/seating'

/**
 * A table in the room.
 *
 * Organiser-only: where a named guest is sitting is personal data, and the seating plan
 * is not guest-facing content in the MVP.
 */
export const Tables: CollectionConfig = {
  slug: 'tables',
  access: {
    read: authenticated,
    create: mutator,
    update: mutator,
    delete: mutator,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['order', 'name', 'capacity', 'shape'],
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'e.g. “Top table”, “Table 4”.' },
    },
    {
      name: 'capacity',
      type: 'number',
      required: true,
      defaultValue: 8,
      min: 1,
      max: 100,
      admin: {
        description: 'Advisory. You can seat more. We will warn, not refuse.',
      },
    },
    {
      name: 'shape',
      type: 'select',
      required: true,
      defaultValue: 'round',
      options: TABLE_SHAPES.map((shape) => ({
        label: shape.charAt(0).toUpperCase() + shape.slice(1),
        value: shape,
      })),
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      index: true,
    },
    { name: 'notes', type: 'textarea', maxLength: 500 },
  ],
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        // Deleting a table returns its guests to the unassigned pane rather than
        // leaving them pointing at a table that no longer exists.
        await req.payload.update({
          collection: 'guests',
          where: { table: { equals: id } },
          data: { table: null },
          req,
          overrideAccess: true,
        })
      },
    ],
  },
  timestamps: true,
}
