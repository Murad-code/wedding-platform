/**
 * Notifications.
 *
 * The only thing a wedding notification has to get right is arriving at the moment it is
 * useful. "You are next, start making your way over" delivered twenty minutes late is
 * worse than silence: the guest walks over to an empty spot and the photographer has
 * moved on. Almost every rule here follows from that.
 */

export const NOTIFICATION_CHANNELS = ['email', 'sms'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const NOTIFICATION_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

/**
 * The kinds of message the platform sends.
 *
 * Deliberately a closed list: every type needs wording, an expiry, and a reason to exist.
 * Adding one is a product decision, not a string literal at a call site.
 */
export const NOTIFICATION_TYPES = ['photo.get-ready', 'photo.now'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export function isNotificationChannel(value: unknown): value is NotificationChannel {
  return typeof value === 'string' && (NOTIFICATION_CHANNELS as readonly string[]).includes(value)
}

export function isNotificationStatus(value: unknown): value is NotificationStatus {
  return typeof value === 'string' && (NOTIFICATION_STATUSES as readonly string[]).includes(value)
}

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value)
}

/* -------------------------------------------------------------------------- */
/* Deduplication                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The key a `UNIQUE` index enforces.
 *
 * Scoped to the guest, the type, and the thing it is about — so an organiser who steps
 * back and re-calls a group does not text everyone twice. Deduplication is the database's
 * job (ADR-023): two concurrent dispatchers both deciding to send is exactly the race
 * that application-level checking loses.
 */
export function dedupeKey(type: NotificationType, guestId: number, subjectId: number): string {
  return `${type}:${subjectId}:${guestId}`
}

/* -------------------------------------------------------------------------- */
/* Who can be reached, and how                                                */
/* -------------------------------------------------------------------------- */

export type Recipient = {
  guestId: number
  displayName: string
  email: string | null
  phone: string | null
  /** Explicit opt-in, recorded with a timestamp. Never assumed from a phone number. */
  smsConsent: boolean
}

export type ChannelChoice =
  | { ok: true; channel: NotificationChannel }
  | { ok: false; reason: 'no-contact-details' | 'sms-not-consented' }

/**
 * Picks how to reach one guest.
 *
 * SMS first when it is available and consented: these messages are read standing on a
 * lawn, and nobody checks email at a wedding. Email is the fallback, not the preference.
 *
 * A phone number is never sufficient on its own. Consent is a separate, explicit,
 * recorded fact (docs/SECURITY.md §7) — a guest gave their number so the couple could
 * reach them, not so software could text them.
 */
export function chooseChannel(recipient: Recipient, smsEnabled: boolean): ChannelChoice {
  const hasPhone = isPresent(recipient.phone)
  const hasEmail = isPresent(recipient.email)

  if (smsEnabled && hasPhone && recipient.smsConsent) return { ok: true, channel: 'sms' }
  if (hasEmail) return { ok: true, channel: 'email' }

  // Distinguished so an organiser can act: one is "we have no way to reach them", the
  // other is "we could, if they had said yes".
  if (smsEnabled && hasPhone) return { ok: false, reason: 'sms-not-consented' }
  return { ok: false, reason: 'no-contact-details' }
}

function isPresent(value: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Whether consent has just been given or withdrawn, and the timestamp to record.
 *
 * Consent must be provable after the fact, so the moment it was given is stored with it;
 * withdrawing clears the timestamp rather than leaving a stale one that would suggest
 * permission the guest has since revoked.
 */
export type ConsentChange = { changed: false } | { changed: true; smsConsentAt: string | null }

export function resolveSmsConsent(previous: boolean, next: boolean, now: Date): ConsentChange {
  if (next === previous) return { changed: false }
  return { changed: true, smsConsentAt: next ? now.toISOString() : null }
}

/* -------------------------------------------------------------------------- */
/* Wording                                                                    */
/* -------------------------------------------------------------------------- */

export type MessageContext = {
  guestName: string
  groupName: string
  coupleNames: string | null
}

export type BuiltMessage = { subject: string; body: string }

/**
 * The text of each message.
 *
 * Short, because it is read on a lock screen at a distance, and it says what to *do*
 * rather than what has happened.
 */
export function buildMessage(type: NotificationType, context: MessageContext): BuiltMessage {
  const from = context.coupleNames ? ` — ${context.coupleNames}` : ''
  const firstName = context.guestName.split(' ')[0] ?? context.guestName

  if (type === 'photo.get-ready') {
    return {
      subject: `You’re next: ${context.groupName}`,
      body: `${firstName}, your photograph (${context.groupName}) is next. Please start making your way over${from}.`,
    }
  }

  return {
    subject: `You’re up now: ${context.groupName}`,
    body: `${firstName}, the photographer is ready for ${context.groupName} now${from}.`,
  }
}

/* -------------------------------------------------------------------------- */
/* Sending, retrying, and giving up                                           */
/* -------------------------------------------------------------------------- */

export type OutboundMessage = {
  channel: NotificationChannel
  to: string
  /** Null for SMS, which has no subject line. */
  subject: string | null
  body: string
}

export type SendOutcome =
  | { ok: true; providerMessageId: string | null }
  /** `retryable` separates "the network blinked" from "that address does not exist". */
  | { ok: false; retryable: boolean; error: string }

/**
 * The seam between the platform and Resend, Twilio, or a console log.
 *
 * Feature code never touches a provider directly (ADR-007), which is what lets tests and
 * CI run without network access or cost.
 */
export type NotificationProvider = {
  readonly name: string
  readonly channel: NotificationChannel
  send(message: OutboundMessage): Promise<SendOutcome>
}

/** Four attempts over roughly twenty seconds — see {@link backoffMs}. */
export const MAX_ATTEMPTS = 4

export function shouldRetry(attempts: number, outcome: SendOutcome): boolean {
  if (outcome.ok) return false
  if (!outcome.retryable) return false
  return attempts < MAX_ATTEMPTS
}

/**
 * Exponential backoff: 1s, 4s, 16s.
 *
 * Deliberately short. A wedding-day alert has minutes of usefulness, so patient retries
 * over an hour would be retrying something nobody wants any more.
 */
export function backoffMs(attempts: number): number {
  return 1_000 * 4 ** Math.max(0, attempts - 1)
}

/**
 * How long each type is worth delivering.
 *
 * The photographer moves on; a message that arrives after that is actively misleading,
 * so an undeliverable one is abandoned rather than queued indefinitely.
 */
const MAX_AGE_MS: Record<NotificationType, number> = {
  'photo.get-ready': 10 * 60_000,
  'photo.now': 5 * 60_000,
}

export function isStale(type: NotificationType, queuedAt: Date, now: Date): boolean {
  return now.getTime() - queuedAt.getTime() > MAX_AGE_MS[type]
}

export type AttemptResult = {
  status: NotificationStatus
  attempts: number
  providerMessageId: string | null
  error: string | null
  /** When to try again; null when there will be no further attempt. */
  retryAfterMs: number | null
}

/**
 * Turns one send attempt into the row to write.
 *
 * Pure, so "gave up after four tries" and "succeeded on the third" are testable without a
 * provider, a database, or a clock.
 */
export function recordAttempt(previousAttempts: number, outcome: SendOutcome): AttemptResult {
  const attempts = previousAttempts + 1

  if (outcome.ok) {
    return {
      status: 'sent',
      attempts,
      providerMessageId: outcome.providerMessageId,
      error: null,
      retryAfterMs: null,
    }
  }

  const retrying = shouldRetry(attempts, outcome)

  return {
    status: retrying ? 'queued' : 'failed',
    attempts,
    providerMessageId: null,
    // Capped: provider errors can carry a whole response body, and this is stored.
    error: outcome.error.slice(0, 500),
    retryAfterMs: retrying ? backoffMs(attempts) : null,
  }
}
