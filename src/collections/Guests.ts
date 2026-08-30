import type { CollectionConfig } from 'payload'

import { authenticated, mutator } from '@/domain/auth/access'
import { AGE_GROUPS } from '@/domain/guests/guest'
import { resolveSmsConsent } from '@/domain/notifications/notification'
import { RSVP_STATUSES } from '@/domain/rsvp/status'

/**
 * An individual invited person.
 *
 * Guest records hold personal data, including dietary, allergy, and accessibility
 * information that is special-category data under GDPR. Read access is restricted to
 * signed-in organisers; the guest-facing invitation page reaches guests only through a
 * server-side, token-resolved query (docs/SECURITY.md §7).
 */
export const Guests: CollectionConfig = {
  slug: 'guests',
  access: {
    read: authenticated,
    create: mutator,
    update: mutator,
    delete: mutator,
  },
  admin: {
    useAsTitle: 'lastName',
    defaultColumns: ['firstName', 'lastName', 'party', 'rsvpStatus', 'ageGroup'],
    description: 'Individual guests. Every guest belongs to one invitation party.',
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'firstName', type: 'text', required: true, admin: { width: '50%' } },
        { name: 'lastName', type: 'text', admin: { width: '50%' } },
      ],
    },
    {
      name: 'party',
      type: 'relationship',
      relationTo: 'invitation-parties',
      required: true,
      index: true,
      admin: { description: 'The group this guest was invited with.' },
    },
    {
      name: 'rsvpStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: RSVP_STATUSES.map((value) => ({
        label: value.charAt(0).toUpperCase() + value.slice(1),
        value,
      })),
    },
    {
      name: 'ageGroup',
      type: 'select',
      required: true,
      defaultValue: 'adult',
      options: AGE_GROUPS.map((value) => ({
        label: value.charAt(0).toUpperCase() + value.slice(1),
        value,
      })),
      admin: { description: 'Drives children’s menu eligibility and catering counts.' },
    },
    {
      name: 'isPlusOne',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'A placeholder seat the inviting guest may name later.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'email', type: 'email', admin: { width: '50%' } },
        { name: 'phone', type: 'text', admin: { width: '50%' } },
      ],
    },
    {
      name: 'smsConsent',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description:
          'Has this guest agreed to receive text messages? Required before any SMS is sent — a phone number on its own is not permission.',
      },
    },
    {
      name: 'smsConsentAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Recorded automatically when consent is given, so it can be evidenced later.',
      },
    },
    {
      name: 'dietaryRequirements',
      type: 'textarea',
      maxLength: 500,
    },
    {
      name: 'allergies',
      type: 'textarea',
      maxLength: 500,
      admin: { description: 'Surfaced prominently to organisers and in the caterer export.' },
    },
    {
      name: 'accessibilityNeeds',
      type: 'textarea',
      maxLength: 500,
    },
    {
      name: 'table',
      type: 'relationship',
      relationTo: 'tables',
      index: true,
      admin: { description: 'Empty means this guest still needs a seat.' },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
    },
    {
      name: 'internalNotes',
      type: 'textarea',
      maxLength: 1000,
      admin: { description: 'Never shown to guests.' },
    },
    {
      name: 'respondedAt',
      type: 'date',
      admin: { readOnly: true },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        // Stamps the moment consent was given or clears it when withdrawn. The rule
        // itself lives in the domain; the hook only applies it.
        if (typeof data.smsConsent !== 'boolean') return data

        const change = resolveSmsConsent(
          originalDoc?.smsConsent === true,
          data.smsConsent,
          new Date(),
        )

        return change.changed ? { ...data, smsConsentAt: change.smsConsentAt } : data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        // Payload's foreign keys are ON DELETE SET NULL, so without this a deleted
        // guest would leave their meal choices behind with a null guest — orphan rows
        // that would still be counted in the caterer's totals.
        await req.payload.delete({
          collection: 'guest-meal-selections',
          where: { guest: { equals: id } },
          req,
          overrideAccess: true,
        })

        // The delivery record carries the rendered message, which contains the guest's
        // name. Erasing the guest has to erase it too.
        await req.payload.delete({
          collection: 'notifications',
          where: { guest: { equals: id } },
          req,
          overrideAccess: true,
        })

        // Photo group membership is a many-to-many join, so a deleted guest would
        // otherwise stay in the group — invisible in the UI, but still counted.
        const groups = await req.payload.find({
          collection: 'photo-groups',
          where: { members: { equals: id } },
          limit: 500,
          depth: 0,
          req,
          overrideAccess: true,
        })

        for (const group of groups.docs) {
          await req.payload.update({
            collection: 'photo-groups',
            id: group.id,
            data: {
              members: (group.members ?? [])
                .map((member) => (typeof member === 'number' ? member : member.id))
                .filter((memberId) => memberId !== id),
            },
            req,
            overrideAccess: true,
          })
        }
      },
    ],
  },
  timestamps: true,
}
