/**
 * The seam between "something changed" and "every phone at the wedding hears about it".
 *
 * One wedding runs one container (ADR-001), so an in-process subscriber registry is
 * sufficient and has no operational cost. This interface exists so that becoming
 * insufficient — replicas, or a hosted push service — is a one-file change rather than a
 * change to every publisher (ADR-006, ADR-007).
 */

export type RealtimeEvent<TData = unknown> = {
  /** Event name as it appears in the SSE stream, e.g. `queue.updated`. */
  name: string
  /**
   * Monotonic per-topic counter. A client that reconnects and sees a revision it has
   * already applied ignores the event, so the server never has to track what any
   * individual connection has received.
   */
  revision: number
  data: TData
}

export type RealtimeListener<TData = unknown> = (event: RealtimeEvent<TData>) => void

export type RealtimeTransport<TData = unknown> = {
  publish(event: RealtimeEvent<TData>): void
  /** Returns an unsubscribe function; callers must invoke it when a connection closes. */
  subscribe(listener: RealtimeListener<TData>): () => void
  readonly subscriberCount: number
}

/**
 * An in-memory fan-out.
 *
 * One slow or broken listener must not stop the others: a guest whose connection is
 * half-closed cannot be allowed to freeze the queue for the rest of the room, so a
 * throwing listener is reported and skipped rather than propagated.
 */
export function createInProcessTransport<TData = unknown>(
  onError: (error: unknown) => void = () => {},
): RealtimeTransport<TData> {
  const listeners = new Set<RealtimeListener<TData>>()

  return {
    publish(event) {
      // Iterating a copy so a listener that unsubscribes itself during delivery — which
      // is exactly what a closing SSE connection does — cannot disturb the iteration.
      for (const listener of [...listeners]) {
        try {
          listener(event)
        } catch (error) {
          onError(error)
        }
      }
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    get subscriberCount() {
      return listeners.size
    },
  }
}
