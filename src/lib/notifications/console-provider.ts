import type {
  NotificationChannel,
  NotificationProvider,
  OutboundMessage,
} from '@/domain/notifications/notification'

/**
 * Writes messages to the server log instead of sending them.
 *
 * The default in development and CI, so tests never make a network call, never cost
 * money, and never text a real person by accident. Selected automatically whenever a real
 * provider is not configured.
 */
export function createConsoleProvider(channel: NotificationChannel): NotificationProvider {
  return {
    name: 'console',
    channel,
    send(message: OutboundMessage) {
      // The rule exists to keep stray debugging out of production. Writing to the
      // console is this provider's entire purpose, and it is only ever selected when no
      // real provider is configured.
      // eslint-disable-next-line no-console
      console.info('[notification]', {
        channel: message.channel,
        // Masked even here. A development log is still a log, and it is the habit that
        // matters (docs/SECURITY.md §7).
        to: mask(message.to),
        subject: message.subject,
        body: message.body,
      })

      return Promise.resolve({ ok: true as const, providerMessageId: `console-${Date.now()}` })
    },
  }
}

/** Enough to tell two recipients apart, not enough to be a contact list. */
function mask(value: string): string {
  const at = value.indexOf('@')
  if (at > 0) return `${value.slice(0, 1)}***${value.slice(at)}`
  return value.length > 4 ? `***${value.slice(-4)}` : '***'
}
