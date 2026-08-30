import type { NotificationProvider, OutboundMessage } from '@/domain/notifications/notification'

const TIMEOUT_MS = 10_000

/**
 * SMS via Twilio.
 *
 * Consent is checked before anything reaches here (`chooseChannel`), because a provider
 * is the wrong place to enforce a lawful basis — it would be one `if` away from being
 * bypassed by the next call site.
 */
export function createTwilioProvider(
  accountSid: string,
  authToken: string,
  from: string,
): NotificationProvider {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  return {
    name: 'twilio',
    channel: 'sms',

    async send(message: OutboundMessage) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: message.to, From: from, Body: message.body }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })

        const body: unknown = await response.json().catch(() => null)

        if (response.ok) {
          const sid =
            body && typeof body === 'object' && typeof (body as { sid?: unknown }).sid === 'string'
              ? (body as { sid: string }).sid
              : null
          return { ok: true as const, providerMessageId: sid }
        }

        const code =
          body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'number'
            ? (body as { code: number }).code
            : null

        return {
          ok: false as const,
          retryable: response.status === 429 || response.status >= 500,
          // Twilio's numeric code says far more than the status; 21211 is an unusable
          // number, 21610 is an unsubscribed one. Neither is worth retrying.
          error: code === null ? `twilio responded ${response.status}` : `twilio error ${code}`,
        }
      } catch (error) {
        return {
          ok: false as const,
          retryable: true,
          error: error instanceof Error ? error.message : 'unknown transport error',
        }
      }
    },
  }
}
