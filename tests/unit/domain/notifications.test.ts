import { describe, expect, it } from 'vitest'

import {
  backoffMs,
  buildMessage,
  chooseChannel,
  dedupeKey,
  isNotificationType,
  isStale,
  MAX_ATTEMPTS,
  recordAttempt,
  resolveSmsConsent,
  shouldRetry,
  type Recipient,
  type SendOutcome,
} from '@/domain/notifications/notification'

function recipient(partial: Partial<Recipient> = {}): Recipient {
  return {
    guestId: 1,
    displayName: 'Ada Kamali',
    email: 'ada@example.test',
    phone: '+447700900123',
    smsConsent: false,
    ...partial,
  }
}

const failed = (retryable: boolean): SendOutcome => ({ ok: false, retryable, error: 'boom' })
const sent: SendOutcome = { ok: true, providerMessageId: 'msg_1' }

describe('notification types', () => {
  it('is a closed list — a typo must not become a new kind of message', () => {
    expect(isNotificationType('photo.now')).toBe(true)
    expect(isNotificationType('photo.NOW')).toBe(false)
    expect(isNotificationType('rsvp.reminder')).toBe(false)
  })
})

describe('dedupeKey', () => {
  it('is stable for the same guest, type, and subject', () => {
    expect(dedupeKey('photo.now', 7, 3)).toBe(dedupeKey('photo.now', 7, 3))
  })

  it('separates guests, types, and subjects', () => {
    const base = dedupeKey('photo.now', 7, 3)
    expect(dedupeKey('photo.now', 8, 3)).not.toBe(base)
    expect(dedupeKey('photo.get-ready', 7, 3)).not.toBe(base)
    expect(dedupeKey('photo.now', 7, 4)).not.toBe(base)
  })

  it('cannot be confused by ids that share digits', () => {
    // "photo.now:1:23" and "photo.now:12:3" must not collide.
    expect(dedupeKey('photo.now', 23, 1)).not.toBe(dedupeKey('photo.now', 3, 12))
  })
})

describe('chooseChannel', () => {
  it('prefers SMS when it is enabled, possible, and consented', () => {
    // These are read standing on a lawn; nobody checks email at a wedding.
    const choice = chooseChannel(recipient({ smsConsent: true }), true)
    expect(choice).toEqual({ ok: true, channel: 'sms' })
  })

  it('never sends SMS without recorded consent, even with a phone number on file', () => {
    // A guest gave their number so the couple could ring them.
    expect(chooseChannel(recipient({ smsConsent: false }), true)).toEqual({
      ok: true,
      channel: 'email',
    })
  })

  it('falls back to email when SMS is switched off for the wedding', () => {
    expect(chooseChannel(recipient({ smsConsent: true }), false)).toEqual({
      ok: true,
      channel: 'email',
    })
  })

  it('says why it cannot reach someone who only has an unconsented phone', () => {
    const choice = chooseChannel(recipient({ email: null, smsConsent: false }), true)
    expect(choice).toEqual({ ok: false, reason: 'sms-not-consented' })
  })

  it('reports no contact details when there is genuinely no way to reach them', () => {
    expect(chooseChannel(recipient({ email: null, phone: null }), true)).toEqual({
      ok: false,
      reason: 'no-contact-details',
    })
  })

  it('treats blank strings as missing, not as an address', () => {
    expect(chooseChannel(recipient({ email: '   ', phone: '' }), true)).toEqual({
      ok: false,
      reason: 'no-contact-details',
    })
  })

  it('does not offer SMS as the reason when SMS is disabled for the wedding', () => {
    expect(chooseChannel(recipient({ email: null, smsConsent: true }), false)).toEqual({
      ok: false,
      reason: 'no-contact-details',
    })
  })
})

describe('resolveSmsConsent', () => {
  const now = new Date('2026-08-30T12:00:00Z')

  it('records when consent was given, so it can be proved later', () => {
    expect(resolveSmsConsent(false, true, now)).toEqual({
      changed: true,
      smsConsentAt: '2026-08-30T12:00:00.000Z',
    })
  })

  it('clears the timestamp when consent is withdrawn', () => {
    // Leaving a stale date would suggest permission the guest has since revoked.
    expect(resolveSmsConsent(true, false, now)).toEqual({ changed: true, smsConsentAt: null })
  })

  it('does not restamp an unchanged consent', () => {
    expect(resolveSmsConsent(true, true, now)).toEqual({ changed: false })
    expect(resolveSmsConsent(false, false, now)).toEqual({ changed: false })
  })
})

describe('buildMessage', () => {
  const context = {
    guestName: 'Ada Kamali',
    groupName: 'Kamali family',
    coupleNames: 'Sarah & Adam',
  }

  it('tells a guest what to do, not what has happened', () => {
    const message = buildMessage('photo.get-ready', context)
    expect(message.body).toContain('start making your way over')
    expect(message.subject).toContain('Kamali family')
  })

  it('uses a first name, because this is read on a lock screen', () => {
    expect(buildMessage('photo.now', context).body.startsWith('Ada,')).toBe(true)
  })

  it('signs off from the couple when their names are known', () => {
    expect(buildMessage('photo.now', context).body).toContain('Sarah & Adam')
  })

  it('reads correctly for a wedding with no names configured', () => {
    const message = buildMessage('photo.now', { ...context, coupleNames: null })
    expect(message.body).not.toContain('—')
    expect(message.body).toContain('Kamali family')
  })

  it('copes with a one-word name', () => {
    const message = buildMessage('photo.now', { ...context, guestName: 'Prince' })
    expect(message.body.startsWith('Prince,')).toBe(true)
  })
})

describe('retrying', () => {
  it('retries a transient failure', () => {
    expect(shouldRetry(1, failed(true))).toBe(true)
  })

  it('never retries a permanent one', () => {
    // A bad address will still be bad in four seconds.
    expect(shouldRetry(1, failed(false))).toBe(false)
  })

  it('gives up after the attempt limit', () => {
    expect(shouldRetry(MAX_ATTEMPTS, failed(true))).toBe(false)
  })

  it('does not retry a success', () => {
    expect(shouldRetry(1, sent)).toBe(false)
  })

  it('backs off exponentially but stays within a wedding-day timescale', () => {
    expect(backoffMs(1)).toBe(1_000)
    expect(backoffMs(2)).toBe(4_000)
    expect(backoffMs(3)).toBe(16_000)
    // All four attempts land inside half a minute; an hour of patient retries would be
    // delivering something nobody wants any more.
    expect(backoffMs(1) + backoffMs(2) + backoffMs(3)).toBeLessThan(30_000)
  })
})

describe('isStale', () => {
  const queued = new Date('2026-08-30T12:00:00Z')

  it('abandons a "you are up now" that could not be delivered promptly', () => {
    expect(isStale('photo.now', queued, new Date('2026-08-30T12:06:00Z'))).toBe(true)
  })

  it('still sends one that is only just late', () => {
    expect(isStale('photo.now', queued, new Date('2026-08-30T12:04:00Z'))).toBe(false)
  })

  it('gives "you are next" a longer life, since it is a warning rather than a call', () => {
    const at = new Date('2026-08-30T12:06:00Z')
    expect(isStale('photo.get-ready', queued, at)).toBe(false)
    expect(isStale('photo.now', queued, at)).toBe(true)
  })
})

describe('recordAttempt', () => {
  it('records a success with the provider’s message id', () => {
    expect(recordAttempt(0, sent)).toEqual({
      status: 'sent',
      attempts: 1,
      providerMessageId: 'msg_1',
      error: null,
      retryAfterMs: null,
    })
  })

  it('re-queues a transient failure with a delay', () => {
    expect(recordAttempt(0, failed(true))).toMatchObject({
      status: 'queued',
      attempts: 1,
      retryAfterMs: 1_000,
    })
  })

  it('fails immediately on a permanent error rather than burning three more attempts', () => {
    expect(recordAttempt(0, failed(false))).toMatchObject({
      status: 'failed',
      attempts: 1,
      retryAfterMs: null,
    })
  })

  it('fails once the attempts are exhausted', () => {
    expect(recordAttempt(MAX_ATTEMPTS - 1, failed(true))).toMatchObject({
      status: 'failed',
      attempts: MAX_ATTEMPTS,
      retryAfterMs: null,
    })
  })

  it('caps the stored error, because provider errors can be a whole response body', () => {
    const outcome: SendOutcome = { ok: false, retryable: true, error: 'x'.repeat(2_000) }
    expect(recordAttempt(0, outcome).error).toHaveLength(500)
  })

  it('keeps no provider message id on a failure', () => {
    expect(recordAttempt(0, failed(true)).providerMessageId).toBeNull()
  })
})
