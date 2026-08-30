import { dispatchDue } from './dispatch'

/**
 * Keeps retrying without a job runner.
 *
 * One wedding runs one container (ADR-001), so an in-process timer is enough and adds no
 * operational surface. It is held on `globalThis` for the same reason the realtime
 * broadcaster is: Next reloads route modules independently, and a module-level handle
 * would let two timers exist at once.
 *
 * This is best-effort by design. If the process restarts mid-backoff the retry is lost,
 * which is why `/api/notifications/dispatch` exists as an explicit drain — and why these
 * messages expire rather than lingering (see `isStale`).
 */
const TIMER = Symbol.for('wedding-platform.notification-timer')

type Store = { handle: ReturnType<typeof setTimeout> | null }

const store = globalThis as typeof globalThis & { [TIMER]?: Store }

function state(): Store {
  store[TIMER] ??= { handle: null }
  return store[TIMER]
}

/**
 * Sends everything due, then arranges to come back for anything still waiting.
 *
 * Intended to be handed to `after()` so it runs once the organiser's response has already
 * gone out.
 */
export async function dispatchSoon(): Promise<void> {
  try {
    const summary = await dispatchDue()
    if (summary.retryInMs !== null) scheduleDispatch(summary.retryInMs)
  } catch (error) {
    // A failed dispatch pass must never surface as a failed organiser action; the
    // messages stay queued and the next pass picks them up.
    console.error('Notification dispatch failed', {
      message: error instanceof Error ? error.message : 'unknown error',
    })
  }
}

/** At most one pending timer: a burst of queue actions should not stack up passes. */
export function scheduleDispatch(delayMs: number): void {
  const current = state()
  if (current.handle) return

  current.handle = setTimeout(
    () => {
      current.handle = null
      void dispatchSoon()
      // Never hold the process open for a retry — this is best-effort work.
    },
    Math.max(0, delayMs),
  )

  current.handle.unref?.()
}
