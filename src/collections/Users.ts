import type { CollectionConfig } from 'payload'

/**
 * Organiser accounts. Guests never have accounts — their invitation token is their
 * capability (ADR-005).
 */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'organiser',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Organiser', value: 'organiser' },
        { label: 'Viewer', value: 'viewer' },
      ],
      admin: {
        description: 'Admins manage team access. Viewers have read-only access.',
      },
    },
  ],
}
