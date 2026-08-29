import type { CollectionConfig } from 'payload'

import { authenticated, mutator } from '@/domain/auth/access'

/**
 * People a guest might need to reach — and suppliers the couple need, kept internal.
 *
 * Read access is organiser-only; the guest site filters by `visibleToGuests` server-side
 * so a hidden number never reaches the browser.
 */
export const WeddingContacts: CollectionConfig = {
  slug: 'wedding-contacts',
  access: {
    read: authenticated,
    create: mutator,
    update: mutator,
    delete: mutator,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['order', 'name', 'role', 'visibleToGuests'],
  },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'text',
      admin: { description: 'e.g. Best Man, Maid of Honour, Wedding Coordinator.' },
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      index: true,
    },
    {
      type: 'row',
      fields: [
        { name: 'phone', type: 'text', admin: { width: '50%' } },
        {
          name: 'whatsapp',
          type: 'text',
          admin: { width: '50%', description: 'Include the country code.' },
        },
      ],
    },
    { name: 'email', type: 'email' },
    {
      name: 'visibleToGuests',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Off by default — turn on only for people happy to be contacted.',
      },
    },
  ],
  timestamps: true,
}
