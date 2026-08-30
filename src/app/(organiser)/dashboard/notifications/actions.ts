'use server'

import { revalidatePath } from 'next/cache'

import { requireMutator } from '@/lib/auth/session'
import { dispatchDue } from '@/lib/notifications/dispatch'

export type DispatchState = { error?: string; message?: string }

/**
 * Sends whatever is waiting, now.
 *
 * Retries are usually automatic; this exists for the case where they were not — the
 * container restarted mid-backoff, or a provider key was fixed after a run of failures.
 */
export async function dispatchNow(
  _previous: DispatchState,
  _formData: FormData,
): Promise<DispatchState> {
  await requireMutator()

  const summary = await dispatchDue()

  revalidatePath('/dashboard/notifications')

  if (summary.attempted === 0) return { message: 'Nothing was waiting to be sent.' }

  return {
    message: `Tried ${summary.attempted}: ${summary.sent} sent, ${summary.requeued} will be retried, ${summary.failed} failed.`,
  }
}
