import type { CollectionConfig } from 'payload'

import { authenticated, nobody } from '@/domain/auth/access'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
} from '@/domain/notifications/notification'

/**
 * One row per message, from the decision to send it to its final outcome.
 *
 * Writes go through the Local API with `overrideAccess`, which is why create, update, and
 * delete are denied to everyone: the delivery record is evidence of what was sent to whom
 * and must not be editable, including by an admin.
 *
 * Holds no recipient address: the address is read from the guest at send time, so a
 * corrected email is used rather than a stale copy, and there is one fewer place holding
 * contact details. The rendered message *is* stored — it has to be, to be sent — which is
 * why deleting a guest deletes their notifications (docs/SECURITY.md §7).
 */
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  access: {
    read: authenticated,
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  admin: {
    useAsTitle: 'dedupeKey',
    defaultColumns: ['type', 'channel', 'status', 'attempts', 'createdAt'],
    description: 'Delivery record for email and SMS. Written by the app, never by hand.',
  },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'guest',
      type: 'relationship',
      relationTo: 'guests',
      required: true,
      index: true,
    },
    {
      name: 'dedupeKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'Makes a repeat send impossible. The uniqueness is enforced by the database, not by a check in code.',
      },
    },
    {
      name: 'channel',
      type: 'select',
      required: true,
      options: NOTIFICATION_CHANNELS.map((value) => ({
        label: value === 'sms' ? 'SMS' : 'Email',
        value,
      })),
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      options: NOTIFICATION_TYPES.map((value) => ({ label: value, value })),
    },
    {
      name: 'provider',
      type: 'text',
      admin: { description: 'Which service actually delivered it, e.g. resend, twilio, console.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      index: true,
      options: NOTIFICATION_STATUSES.map((value) => ({
        label: value.charAt(0).toUpperCase() + value.slice(1),
        value,
      })),
    },
    {
      name: 'subject',
      type: 'text',
      admin: { description: 'Empty for SMS, which has no subject line.' },
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
      maxLength: 1000,
      admin: {
        description:
          'The message as it was sent. Rendered when the message is queued so the dispatcher never has to know what a photo group is.',
      },
    },
    { name: 'providerMessageId', type: 'text' },
    { name: 'attempts', type: 'number', required: true, defaultValue: 0 },
    { name: 'lastAttemptAt', type: 'date' },
    {
      name: 'nextAttemptAt',
      type: 'date',
      index: true,
      admin: { description: 'When the dispatcher will try again. Empty means it will not.' },
    },
    {
      name: 'error',
      type: 'textarea',
      maxLength: 500,
      admin: { description: 'The provider’s reason for the last failure.' },
    },
  ],
  timestamps: true,
}
