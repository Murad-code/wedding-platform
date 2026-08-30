import type { GlobalConfig } from 'payload'

import { authenticated, mutator } from '@/domain/auth/access'

/**
 * The photo queue's revision counter.
 *
 * Every change to the queue increments it, and every event carries it. A phone that
 * reconnects after the venue wifi drops compares the revision it last applied with the
 * one in the first event it receives: if it is behind, it takes the snapshot it was just
 * sent and moves on. That is what lets the server forget its clients entirely — it never
 * has to know which events any given connection missed (ADR-006).
 */
export const PhotoQueueState: GlobalConfig = {
  slug: 'photo-queue-state',
  access: {
    read: authenticated,
    update: mutator,
  },
  admin: {
    description: 'Internal state for the live photo queue. Maintained by the app.',
  },
  fields: [
    {
      name: 'revision',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Increases by one on every change to the queue.',
      },
    },
    {
      name: 'lastActionAt',
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
  ],
}
