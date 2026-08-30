import type { NotificationProvider, OutboundMessage } from '@/domain/notifications/notification'

/** A hung provider must not hold the dispatcher open while the wedding moves on. */
const TIMEOUT_MS = 10_000

/**
 * Email via Resend.
 *
 * Plain `fetch` rather than the SDK: this is one POST, and a dependency that ships its
 * own retry and logging would sit awkwardly next to the retry policy and redaction rules
 * this platform already has (the same reasoning as ADR-014).
 */
export function createResendProvider(apiKey: string, from: string): NotificationProvider {
  return {
    name: 'resend',
    channel: 'email',

    async send(message: OutboundMessage) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject ?? '',
            text: message.body,
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })

        if (response.ok) {
          const body: unknown = await response.json().catch(() => null)
          const id =
            body && typeof body === 'object' && typeof (body as { id?: unknown }).id === 'string'
              ? (body as { id: string }).id
              : null
          return { ok: true as const, providerMessageId: id }
        }

        return {
          ok: false as const,
          // 4xx other than rate limiting means the request itself is wrong — a malformed
          // address will still be malformed in four seconds.
          retryable: response.status === 429 || response.status >= 500,
          error: `resend responded ${response.status}`,
        }
      } catch (error) {
        // Network failure or timeout: worth another try.
        return {
          ok: false as const,
          retryable: true,
          error: error instanceof Error ? error.message : 'unknown transport error',
        }
      }
    },
  }
}
