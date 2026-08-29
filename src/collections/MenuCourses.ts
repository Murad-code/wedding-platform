import type { CollectionConfig } from 'payload'

import { anyone, mutator } from '@/domain/auth/access'

/**
 * A course on the wedding menu — Starter, Main, Children's, and so on.
 *
 * Publicly readable: the menu is guest-facing content shown on the wedding website and
 * in the RSVP flow. It contains no personal data; guests' *choices* live elsewhere and
 * are organiser-only.
 */
export const MenuCourses: CollectionConfig = {
  slug: 'menu-courses',
  access: {
    read: anyone,
    create: mutator,
    update: mutator,
    delete: mutator,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['order', 'name', 'required', 'childrenOnly'],
  },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'textarea', maxLength: 500 },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      index: true,
      admin: { description: 'Lower numbers appear first.' },
    },
    {
      name: 'required',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Guests must choose from this course before their reply is complete.',
      },
    },
    {
      name: 'childrenOnly',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Offered only to guests marked as children.' },
    },
  ],
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        // Options and any choices made from them go with the course, so a deleted
        // course cannot leave orphaned selections behind.
        await req.payload.delete({
          collection: 'guest-meal-selections',
          where: { course: { equals: id } },
          req,
          overrideAccess: true,
        })
        await req.payload.delete({
          collection: 'menu-options',
          where: { course: { equals: id } },
          req,
          overrideAccess: true,
        })
      },
    ],
  },
  timestamps: true,
}
