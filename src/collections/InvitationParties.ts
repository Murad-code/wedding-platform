import type { CollectionConfig } from 'payload'

import { authenticated, mutator } from '@/domain/auth/access'
import { PARTY_STATUSES } from '@/domain/rsvp/status'

/**
 * People invited together — the unit that receives an invitation link and responds.
 *
 * Nothing here is publicly readable. The guest invitation page resolves a party
 * server-side from a token and returns only that party (docs/SECURITY.md T4).
 */
export const InvitationParties: CollectionConfig = {
  slug: 'invitation-parties',
  access: {
    read: authenticated,
    create: mutator,
    update: mutator,
    delete: mutator,
  },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'status', 'plusOnesAllowed', 'respondedAt'],
    description: 'Households and groups invited together.',
  },
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'How this group is addressed, e.g. “The Kamali Family”.',
      },
    },
    {
      name: 'tokenHash',
      type: 'text',
      unique: true,
      index: true,
      access: {
        // Nothing legitimately reads this over the API. Invitation lookup happens
        // server-side with overrideAccess, so keeping it unreadable removes an entire
        // class of accidental leak (docs/SECURITY.md §2).
        read: () => false,
        create: () => false,
        update: () => false,
      },
      admin: { hidden: true },
    },
    {
      name: 'tokenVersion',
      type: 'number',
      defaultValue: 1,
      admin: {
        hidden: true,
        description: 'Incremented on rotation so old links stop working.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: PARTY_STATUSES.map((value) => ({
        label: value.charAt(0).toUpperCase() + value.slice(1),
        value,
      })),
      admin: {
        readOnly: true,
        description: 'Derived from the guests’ individual responses.',
      },
    },
    {
      name: 'plusOnesAllowed',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 10,
      admin: { description: 'How many extra guests this party may bring.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'contactEmail', type: 'email', admin: { width: '50%' } },
        { name: 'contactPhone', type: 'text', admin: { width: '50%' } },
      ],
    },
    {
      name: 'messageToCouple',
      type: 'textarea',
      admin: {
        readOnly: true,
        description: 'Left by the party when they responded.',
      },
    },
    {
      name: 'internalNotes',
      type: 'textarea',
      admin: { description: 'Only ever visible to organisers.' },
    },
    {
      name: 'invitedAt',
      type: 'date',
      admin: { description: 'When the invitation link was shared.' },
    },
    {
      name: 'respondedAt',
      type: 'date',
      admin: { readOnly: true },
    },
  ],
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        // Guests belong to exactly one party; removing a party removes its guests.
        // Done explicitly rather than relying on database cascade so Payload's own
        // hooks and audit trail see the deletions.
        await req.payload.delete({
          collection: 'guests',
          where: { party: { equals: id } },
          req,
          overrideAccess: true,
        })
      },
    ],
  },
  timestamps: true,
}
