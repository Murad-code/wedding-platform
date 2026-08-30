import type {
  NotificationChannel,
  NotificationProvider,
  OutboundMessage,
} from '@/domain/notifications/notification'

import { logger } from '../logger'

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
      logger.info('Notification (console provider)', {
        channel: message.channel,
        // Masked before it reaches the logger, which would otherwise redact the address
        // outright and leave a developer unable to tell two recipients apart.
        recipient: mask(message.to),
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
