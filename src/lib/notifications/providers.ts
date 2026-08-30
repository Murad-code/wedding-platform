import type { NotificationChannel, NotificationProvider } from '@/domain/notifications/notification'

import { createConsoleProvider } from './console-provider'
import { createResendProvider } from './resend-provider'
import { createTwilioProvider } from './twilio-provider'

/**
 * Chooses the provider for a channel from the environment.
 *
 * Falls back to the console provider whenever a real one is not fully configured, so a
 * half-set-up deployment logs its messages rather than throwing in the middle of the
 * wedding day. Configuration is read per call rather than cached, so rotating a key does
 * not require a restart.
 */
export function providerFor(channel: NotificationChannel): NotificationProvider {
  if (channel === 'email') {
    const apiKey = process.env.RESEND_API_KEY
    const address = process.env.EMAIL_FROM_ADDRESS
    const name = process.env.EMAIL_FROM_NAME

    if (apiKey && address) {
      return createResendProvider(apiKey, name ? `${name} <${address}>` : address)
    }
    return createConsoleProvider('email')
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (sid && token && from) return createTwilioProvider(sid, token, from)
  return createConsoleProvider('sms')
}
