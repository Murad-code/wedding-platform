import { APIError, type CollectionConfig, type PayloadRequest } from 'payload'

import { authenticated, teamManager } from '@/domain/auth/access'
import { toActor } from '@/domain/auth/access'
import { ROLES, isAdmin, isRole } from '@/domain/auth/roles'
import { checkRemoval, checkRoleChange, type TeamMember } from '@/domain/auth/team'

async function teamOf(req: PayloadRequest): Promise<TeamMember[]> {
  const users = await req.payload.find({
    collection: 'users',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return users.docs.flatMap((user) => (isRole(user.role) ? [{ id: user.id, role: user.role }] : []))
}

const actorIdOf = (req: PayloadRequest) => toActor(req.user)?.id ?? null

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
  // Enforced here rather than only in the dashboard, so Payload admin and the REST API
  // cannot demote or remove the last admin or let someone change their own role.
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (operation !== 'update' || !originalDoc || !isRole(data.role)) return data
        if (data.role === originalDoc.role) return data

        const check = checkRoleChange(await teamOf(req), actorIdOf(req), originalDoc.id, data.role)
        if (!check.ok) throw new APIError(check.reason, 400, undefined, true)
        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const check = checkRemoval(await teamOf(req), actorIdOf(req), id)
        if (!check.ok) throw new APIError(check.reason, 400, undefined, true)
      },
    ],
  },
}
