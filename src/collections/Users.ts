import type { CollectionConfig } from 'payload'

import { authenticated, teamManager } from '@/domain/auth/access'
import { toActor } from '@/domain/auth/access'
import { ROLES, isAdmin } from '@/domain/auth/roles'

/**
 * Organiser accounts. Guests never have accounts — their invitation token is their
 * capability (ADR-005).
 */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  access: {
    read: authenticated,
    create: teamManager,
    update: teamManager,
    delete: teamManager,
    // Payload Admin is a maintenance tool, not the organiser product (ADR-003).
    admin: ({ req }) => isAdmin(toActor(req.user)),
  },
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
      options: ROLES.map((role) => ({
        label: role.charAt(0).toUpperCase() + role.slice(1),
        value: role,
      })),
      access: {
        // Prevents privilege escalation: a user cannot promote themselves by editing
        // their own profile (docs/SECURITY.md T6).
        update: ({ req }) => isAdmin(toActor(req.user)),
      },
      admin: {
        description: 'Admins manage team access. Viewers have read-only access.',
      },
    },
  ],
}
