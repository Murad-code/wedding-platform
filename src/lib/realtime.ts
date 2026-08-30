import type { QueueSnapshot } from '@/domain/photo-queue/queue'
import { createInProcessTransport, type RealtimeTransport } from '@/domain/realtime/transport'

/**
 * The process-wide broadcaster.
 *
 * Held on `globalThis` because Next reloads route modules independently in development
 * and across route groups: a plain module-level constant would give the SSE endpoint and
 * the server action that publishes to it two different registries, and the queue would
 * silently stop updating. This is the same reason the Payload and Prisma clients are
 * conventionally stored this way.
 */
const REGISTRY = Symbol.for('wedding-platform.realtime')

type Registry = { photoQueue: RealtimeTransport<QueueSnapshot> }

const store = globalThis as typeof globalThis & { [REGISTRY]?: Registry }

export function photoQueueTransport(): RealtimeTransport<QueueSnapshot> {
  store[REGISTRY] ??= {
    photoQueue: createInProcessTransport<QueueSnapshot>((error) => {
      // A failed delivery to one phone is not an application error; the client will
      // reconnect and resync from the revision. Never log the event itself.
      console.warn('Photo queue: dropping a subscriber that failed to receive', {
        message: error instanceof Error ? error.message : 'unknown error',
      })
    }),
  }

  return store[REGISTRY].photoQueue
}
