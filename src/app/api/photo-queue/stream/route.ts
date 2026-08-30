import type { QueueSnapshot } from '@/domain/photo-queue/queue'
import { getSnapshot } from '@/lib/photo-queue'
import { photoQueueTransport } from '@/lib/realtime'
import { getWeddingSettings } from '@/lib/wedding'

export const dynamic = 'force-dynamic'

/** Comfortably inside the 30–60s idle timeout of a typical proxy. */
const HEARTBEAT_MS = 25_000

/**
 * A ceiling on open streams, rather than a per-address rate limit.
 *
 * Guests at one venue share a NAT, so throttling connections per IP would shut out the
 * whole room — the same reasoning as ADR-016. A global cap protects the server without
 * punishing the case we are actually built for; anyone turned away falls back to polling.
 */
const MAX_SUBSCRIBERS = 500

/**
 * Server-sent events for the live photo queue.
 *
 * Each connection is sent the current snapshot immediately, which is also what makes
 * reconnection work: a phone that drops out and comes back does not replay what it
 * missed, it is simply given the present state with its revision, and the client ignores
 * anything not newer than what it already has (ADR-006).
 */
export async function GET(request: Request) {
  const settings = await getWeddingSettings()
  if (!settings.features.photoQueue) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const transport = photoQueueTransport()
  if (transport.subscriberCount >= MAX_SUBSCRIBERS) {
    // 503 with Retry-After tells EventSource to come back rather than to give up.
    return new Response('Too many listeners', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' },
    })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true
      let unsubscribe: (() => void) | null = null
      let heartbeat: ReturnType<typeof setInterval> | null = null

      const close = () => {
        if (!open) return
        open = false
        if (heartbeat) clearInterval(heartbeat)
        unsubscribe?.()
        try {
          controller.close()
        } catch {
          // Already closed by the runtime when the client vanished mid-write.
        }
      }

      const send = (chunk: string) => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          close()
        }
      }

      // Registered before the first await: a client that gives up during the initial
      // query would otherwise leave a subscriber behind for the rest of the day.
      request.signal.addEventListener('abort', close)
      if (request.signal.aborted) return close()

      // Venue wifi drops constantly, so reconnect sooner than the browser's 3s default
      // would apply after a server restart.
      send('retry: 2000\n\n')

      const snapshot = await getSnapshot()
      if (!open) return
      send(event(snapshot))

      unsubscribe = transport.subscribe((published) => send(event(published.data)))
      heartbeat = setInterval(() => send(': keep-alive\n\n'), HEARTBEAT_MS)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      // Tells nginx-style proxies not to buffer, which would hold events until the
      // buffer filled — for a queue that changes every few minutes, effectively forever.
      'X-Accel-Buffering': 'no',
    },
  })
}

function event(snapshot: QueueSnapshot): string {
  // `id:` lets the browser send Last-Event-ID on reconnect. We do not replay from it —
  // the fresh snapshot is the resync — but it makes the revision visible in devtools.
  return `id: ${snapshot.revision}\nevent: queue.updated\ndata: ${JSON.stringify(snapshot)}\n\n`
}
