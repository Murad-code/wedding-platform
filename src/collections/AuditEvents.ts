import type { CollectionConfig } from 'payload'

import { authenticated, nobody } from '@/domain/auth/access'

/**
 * Append-only record of who changed what (docs/SECURITY.md §10).
 *
 * Deliberately holds no PII payloads and no invitation tokens — only enough to answer
 * "who did this, to what, and when". IP addresses are stored salted-hashed, never raw.
 *
 * Writes happen through the Local API with `overrideAccess`, which is why create/update/
 * delete are denied to everyone: the log must not be editable, including by admins.
 */
export const AuditEvents: CollectionConfig = {
  slug: 'audit-events',
  access: {
    read: authenticated,
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  admin: {
    useAsTitle: 'action',
    defaultColumns: ['action', 'entityType', 'actorType', 'createdAt'],
    description: 'Append-only activity log.',
  },
  fields: [
    {
      name: 'action',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'e.g. rsvp.submitted, guest.deleted, invitation.rotated' },
    },
    {
      name: 'actorType',
      type: 'select',
      required: true,
      defaultValue: 'system',
      options: [
        { label: 'Organiser', value: 'user' },
        { label: 'Guest', value: 'guest' },
        { label: 'System', value: 'system' },
      ],
    },
    {
      name: 'actorUser',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Set when an organiser performed the action.' },
    },
    { name: 'entityType', type: 'text', index: true },
    { name: 'entityId', type: 'text' },
    {
      name: 'metadata',
      type: 'json',
      admin: { description: 'Non-identifying context only. Never tokens or guest PII.' },
    },
    {
      name: 'ipHash',
      type: 'text',
      admin: { description: 'Salted hash. Never a raw IP address.' },
    },
  ],
  timestamps: true,
}
