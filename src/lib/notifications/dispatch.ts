import config from '@payload-config'
import { getPayload } from 'payload'

import {
  buildMessage,
  chooseChannel,
  dedupeKey,
  isNotificationChannel,
  isNotificationType,
  isStale,
  recordAttempt,
  type MessageContext,
  type NotificationType,
  type Recipient,
} from '@/domain/notifications/notification'

import { providerFor } from './providers'

export type EnqueueInput = {
  type: NotificationType
  /** What the message is about — a photo group id. Part of the dedupe key. */
  subjectId: number
  recipient: Recipient
  context: Omit<MessageContext, 'guestName'>
  smsEnabled: boolean
}

export type EnqueueResult =
  | { queued: true }
  | { queued: false; reason: 'duplicate' | 'no-contact-details' | 'sms-not-consented' }

/**
 * Records the intention to send, and nothing more.
 *
 * One insert, then the caller's request is free to finish. Delivery happens afterwards
 * (see {@link dispatchDue}), because an organiser pressing *Call next* must not wait on
 * Twilio (docs/ARCHITECTURE.md §6).
 *
 * A guest who cannot be reached gets **no row at all**. Recording a failure would consume
 * the dedupe key, and adding their email address ten minutes later would then be silently
 * ignored — the caller surfaces the count instead.
 */
export async function enqueue(input: EnqueueInput): Promise<EnqueueResult> {
  const choice = chooseChannel(input.recipient, input.smsEnabled)
  if (!choice.ok) return { queued: false, reason: choice.reason }

  const message = buildMessage(input.type, {
    ...input.context,
    guestName: input.recipient.displayName,
  })

  const payload = await getPayload({ config })

  try {
    await payload.create({
      collection: 'notifications',
      overrideAccess: true,
      data: {
        guest: input.recipient.guestId,
        dedupeKey: dedupeKey(input.type, input.recipient.guestId, input.subjectId),
        channel: choice.channel,
        type: input.type,
        status: 'queued',
        attempts: 0,
        nextAttemptAt: new Date().toISOString(),
        subject: message.subject,
        body: message.body,
      },
    })

    return { queued: true }
  } catch (error) {
    // The unique index on dedupeKey is the deduplication mechanism (ADR-023). Two
    // concurrent callers both reaching here is normal; the second insert simply loses.
    if (isDuplicateKey(error)) return { queued: false, reason: 'duplicate' }

    // Anything else is a real failure and must not be disguised as a duplicate — a
    // database that is down would otherwise look like "already sent" and the guest would
    // never be told.
    throw error
  }
}

/**
 * Recognises a lost race on the dedupe key.
 *
 * Payload checks uniqueness before inserting and reports a validation error, but two
 * callers can still both pass that check and collide in the database itself, so the
 * Postgres unique-violation code is treated the same way.
 *
 * Matched on the error's **shape**, never its class name: a production build minifies
 * `ValidationError` to a single letter, so a `name === 'ValidationError'` check passes
 * every test and then fails in the only environment that ships.
 */
function isDuplicateKey(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    code?: unknown
    cause?: unknown
    data?: { errors?: { path?: unknown }[] }
  }

  if (candidate.code === '23505') return true

  if (
    Array.isArray(candidate.data?.errors) &&
    candidate.data.errors.some((issue) => issue.path === 'dedupeKey')
  ) {
    return true
  }

  return candidate.cause !== error && isDuplicateKey(candidate.cause)
}

export type DispatchSummary = {
  attempted: number
  sent: number
  failed: number
  requeued: number
  /** Milliseconds until the earliest pending retry, or null when nothing is waiting. */
  retryInMs: number | null
}

const EMPTY: DispatchSummary = { attempted: 0, sent: 0, failed: 0, requeued: 0, retryInMs: null }

/**
 * Sends everything that is due.
 *
 * Each row is claimed with a conditional update before any provider is called, so two
 * dispatchers running at once cannot both send the same message: the second update
 * matches nothing and moves on.
 */
export async function dispatchDue(limit = 25): Promise<DispatchSummary> {
  const payload = await getPayload({ config })
  const now = new Date()

  const due = await payload.find({
    collection: 'notifications',
    where: {
      and: [
        { status: { equals: 'queued' } },
        { nextAttemptAt: { less_than_equal: now.toISOString() } },
      ],
    },
    limit,
    sort: 'nextAttemptAt',
    depth: 0,
    overrideAccess: true,
  })

  if (due.docs.length === 0) return { ...EMPTY, retryInMs: await nextRetryInMs(now) }

  const summary = { ...EMPTY }

  for (const doc of due.docs) {
    // Claiming and sending are separate: whoever wins this update owns the send.
    const claimed = await payload.update({
      collection: 'notifications',
      where: { and: [{ id: { equals: doc.id } }, { status: { equals: 'queued' } }] },
      data: { status: 'sending' },
      overrideAccess: true,
    })

    if (claimed.docs.length === 0) continue

    summary.attempted += 1
    const result = await deliver(doc.id)

    if (result === 'sent') summary.sent += 1
    else if (result === 'failed') summary.failed += 1
    else summary.requeued += 1
  }

  return { ...summary, retryInMs: await nextRetryInMs(new Date()) }
}

type DeliveryResult = 'sent' | 'failed' | 'requeued'

async function deliver(id: number): Promise<DeliveryResult> {
  const payload = await getPayload({ config })

  const doc = await payload.findByID({
    collection: 'notifications',
    id,
    depth: 1,
    overrideAccess: true,
  })

  const type = isNotificationType(doc.type) ? doc.type : null
  const channel = isNotificationChannel(doc.channel) ? doc.channel : null

  if (!type || !channel) {
    return finish(id, {
      status: 'failed',
      error: 'unrecognised notification',
      attempts: doc.attempts ?? 0,
    })
  }

  // A wedding-day alert has minutes of usefulness. Delivering "you are next" after the
  // photographer has moved on is worse than not delivering it at all.
  if (doc.createdAt && isStale(type, new Date(doc.createdAt), new Date())) {
    return finish(id, {
      status: 'failed',
      error: 'expired before it could be delivered',
      attempts: doc.attempts ?? 0,
    })
  }

  const guest = typeof doc.guest === 'object' && doc.guest !== null ? doc.guest : null
  const to = channel === 'sms' ? guest?.phone : guest?.email

  if (!to) {
    // The address is read at send time rather than stored, so it can disappear between
    // queueing and sending — the guest was edited, or deleted.
    return finish(id, {
      status: 'failed',
      error: 'no address for this guest',
      attempts: doc.attempts ?? 0,
    })
  }

  const provider = providerFor(channel)
  const outcome = await provider.send({
    channel,
    to,
    subject: channel === 'email' ? (doc.subject ?? null) : null,
    body: doc.body,
  })

  const attempt = recordAttempt(doc.attempts ?? 0, outcome)

  await payload.update({
    collection: 'notifications',
    id,
    overrideAccess: true,
    data: {
      status: attempt.status,
      attempts: attempt.attempts,
      provider: provider.name,
      providerMessageId: attempt.providerMessageId,
      error: attempt.error,
      lastAttemptAt: new Date().toISOString(),
      nextAttemptAt:
        attempt.retryAfterMs === null
          ? null
          : new Date(Date.now() + attempt.retryAfterMs).toISOString(),
    },
  })

  if (attempt.status === 'sent') return 'sent'
  return attempt.status === 'failed' ? 'failed' : 'requeued'
}

async function finish(
  id: number,
  data: { status: 'failed'; error: string; attempts: number },
): Promise<DeliveryResult> {
  const payload = await getPayload({ config })

  await payload.update({
    collection: 'notifications',
    id,
    overrideAccess: true,
    data: {
      status: data.status,
      error: data.error,
      attempts: data.attempts,
      lastAttemptAt: new Date().toISOString(),
      nextAttemptAt: null,
    },
  })

  return 'failed'
}

/** How long until the next queued retry becomes due. */
async function nextRetryInMs(now: Date): Promise<number | null> {
  const payload = await getPayload({ config })

  const pending = await payload.find({
    collection: 'notifications',
    where: { status: { equals: 'queued' } },
    sort: 'nextAttemptAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const next = pending.docs[0]?.nextAttemptAt
  if (!next) return null

  return Math.max(0, new Date(next).getTime() - now.getTime())
}

/**
 * Loads the people a notification could go to.
 *
 * Falls back to the party's contact details, because that is usually all there is: a
 * household RSVPs with one email and one number, and individual guests often have
 * neither. Keeping the number on the party rather than copying it onto every guest means
 * one place to correct it and one place to erase it.
 *
 * Consent travels with the recipient rather than being looked up later, so the decision
 * to use SMS is made from one consistent snapshot of the guest.
 */
export async function recipientsFor(guestIds: readonly number[]): Promise<Recipient[]> {
  if (guestIds.length === 0) return []

  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'guests',
    where: { id: { in: [...guestIds] } },
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })

  return result.docs.map((guest) => {
    const party = typeof guest.party === 'object' && guest.party !== null ? guest.party : null

    return {
      guestId: guest.id,
      displayName: [guest.firstName, guest.lastName].filter(Boolean).join(' '),
      email: guest.email ?? party?.contactEmail ?? null,
      phone: guest.phone ?? party?.contactPhone ?? null,
      // Never inherited from the party: consent is the guest's own, and a household
      // contact number does not make everyone in it contactable by text.
      smsConsent: guest.smsConsent === true,
    }
  })
}
