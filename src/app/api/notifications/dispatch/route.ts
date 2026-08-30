import { requireMutator } from '@/lib/auth/session'
import { dispatchDue } from '@/lib/notifications/dispatch'

export const dynamic = 'force-dynamic'

/**
 * Drains the notification queue on demand.
 *
 * Retries are normally handled by an in-process timer, which is enough for one container
 * but does not survive a restart. This endpoint is the explicit way back: an external
 * scheduler, or an organiser pressing "try again", can force a pass.
 *
 * Organiser-only. Sending messages costs money and reaches real people, so it is a
 * mutation and is authorised as one.
 */
export async function POST() {
  await requireMutator()

  const summary = await dispatchDue()

  return Response.json(summary, { headers: { 'Cache-Control': 'no-store' } })
}
