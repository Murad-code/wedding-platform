import type { CollectionConfig } from 'payload'

import { authenticated, mutator } from '@/domain/auth/access'

/** Free-form organiser labels, e.g. "bride's side", "evening only". */
export const Tags: CollectionConfig = {
  slug: 'tags',
  access: {
    read: authenticated,
    create: mutator,
    update: mutator,
    delete: mutator,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
  ],
  timestamps: true,
}
