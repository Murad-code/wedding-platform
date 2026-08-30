import type { CollectionConfig } from 'payload'

import { authenticated, mutator } from '@/domain/auth/access'
import { PHOTO_GROUP_STATUSES } from '@/domain/photo-queue/queue'

/**
 * One photograph to be taken: a named group, its members, and where it sits in the run.
 *
 * Closed to anonymous reads. The guest-facing queue is served from a server-side
 * projection that strips membership — a publicly readable collection here would be a
 * guest directory by another name (docs/SECURITY.md §5).
 */
export const PhotoGroups: CollectionConfig = {
  slug: 'photo-groups',
  access: {
    read: authenticated,
    create: mutator,
    update: mutator,
    delete: mutator,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['order', 'name', 'status', 'estimatedMinutes'],
    description: 'The photographs to take, in the order the photographer will call them.',
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'What the photographer will call out, e.g. “Bride’s immediate family”. Guests see this.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 500,
      admin: { description: 'Optional note, e.g. “on the terrace steps”. Guests see this.' },
    },
    {
      name: 'estimatedMinutes',
      type: 'number',
      min: 1,
      max: 120,
      admin: {
        description:
          'Roughly how long this photo takes. Used to tell guests when to start heading over.',
      },
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      index: true,
      admin: { description: 'Lower numbers are photographed first.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      index: true,
      options: PHOTO_GROUP_STATUSES.map((value) => ({
        label: value
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        value,
      })),
      admin: {
        description: 'Managed by the wedding-day controller. You should not need to set this.',
      },
    },
    {
      name: 'members',
      type: 'relationship',
      relationTo: 'guests',
      hasMany: true,
      index: true,
      admin: { description: 'Who needs to be in this photograph.' },
    },
  ],
  timestamps: true,
}
