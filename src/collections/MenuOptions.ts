import type { CollectionConfig } from 'payload'

import { anyone, mutator } from '@/domain/auth/access'

/** A choice within a course. A fixed menu is simply a course with one option. */
export const MenuOptions: CollectionConfig = {
  slug: 'menu-options',
  access: {
    read: anyone,
    create: mutator,
    update: mutator,
    delete: mutator,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['order', 'name', 'course'],
  },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'textarea', maxLength: 500 },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'menu-courses',
      required: true,
      index: true,
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
        { name: 'isVegetarian', type: 'checkbox', defaultValue: false },
        { name: 'isVegan', type: 'checkbox', defaultValue: false },
        { name: 'isGlutenFree', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({
          collection: 'guest-meal-selections',
          where: { option: { equals: id } },
          req,
          overrideAccess: true,
        })
      },
    ],
  },
  timestamps: true,
}
