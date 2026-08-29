import type { CollectionConfig } from 'payload'

import { authenticated, mutator } from '@/domain/auth/access'

/**
 * One guest's choice for one course.
 *
 * A separate collection rather than an array on `Guest` so the database can enforce
 * "at most one choice per course" (docs/DATA_MODEL.md). Both the RSVP form and the
 * organiser dashboard write here, and a hook would not survive concurrent writes the
 * way a unique index does.
 *
 * Choices are personal data tied to a named guest, so unlike the menu itself this is
 * never publicly readable.
 */
export const GuestMealSelections: CollectionConfig = {
  slug: 'guest-meal-selections',
  access: {
    read: authenticated,
    create: mutator,
    update: mutator,
    delete: mutator,
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['guest', 'course', 'option'],
    description: 'What each guest chose. Written by the RSVP form and the dashboard.',
  },
  indexes: [
    // The constraint promised in docs/DATA_MODEL.md: a guest picks at most one option
    // per course, enforced by the database rather than by application logic.
    { fields: ['guest', 'course'], unique: true },
  ],
  fields: [
    {
      name: 'guest',
      type: 'relationship',
      relationTo: 'guests',
      required: true,
      index: true,
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'menu-courses',
      required: true,
      index: true,
    },
    {
      name: 'option',
      type: 'relationship',
      relationTo: 'menu-options',
      required: true,
    },
  ],
  timestamps: true,
}
