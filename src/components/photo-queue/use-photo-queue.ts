'use client'

import { useCallback, useEffect, useState } from 'react'

import type { QueueSnapshot } from '@/domain/photo-queue/queue'

/**
 * What the screen tells the guest about its own connection.
 *
 * Shown plainly rather than hidden: a frozen queue that looks live is worse than one
 * that admits it is catching up (docs/UX.md §4.2).
 */
export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'polling'

/** Consecutive stream failures tolerated before falling back to polling. */
const FAILURES_BEFORE_POLLING = 3

const POLL_INTERVAL_MS = 8_000

/** How often to see whether the stream has come back, once polling. */
const STREAM_RETRY_MS = 60_000

/**
 * Keeps a snapshot of the photo queue current.
 *
 * Prefers a server-sent event stream and falls back to polling, because this runs
 * outdoors on venue wifi during the one half hour where being wrong matters. Snapshots
 * are applied only when their revision is newer, so a duplicate or out-of-order delivery
 * — the normal consequence of a reconnect — cannot move the queue backwards.
 */
export function usePhotoQueue(initial: QueueSnapshot) {
  const [snapshot, setSnapshot] = useState(initial)
  const [connection, setConnection] = useState<ConnectionState>('connecting')

  const applySnapshot = useCallback((next: QueueSnapshot) => {
    setSnapshot((current) => (next.revision > current.revision ? next : current))
  }, [])

  useEffect(() => {
    let disposed = false
    let source: EventSource | null = null
    let poll: ReturnType<typeof setInterval> | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let failures = 0

    const receive = (raw: string) => {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && 'revision' in parsed) {
          applySnapshot(parsed as QueueSnapshot)
        }
      } catch {
        // A truncated frame is not worth surfacing; the next event carries the same
        // state, and the revision guard makes a missed one harmless.
      }
    }

    const fetchOnce = async () => {
      try {
        const response = await fetch('/api/photo-queue', { cache: 'no-store' })
        if (!response.ok) return
        const parsed: unknown = await response.json()
        if (!disposed && parsed && typeof parsed === 'object' && 'revision' in parsed) {
          applySnapshot(parsed as QueueSnapshot)
        }
      } catch {
        // Offline. Keep the last known queue on screen and try again next tick.
      }
    }

    const startPolling = () => {
      if (poll || disposed) return
      setConnection('polling')
      void fetchOnce()
      poll = setInterval(() => void fetchOnce(), POLL_INTERVAL_MS)
      // Keep trying the stream: a venue's wifi usually comes back, and events are
      // both cheaper and immediate.
      retry = setTimeout(connect, STREAM_RETRY_MS)
    }

    const stopPolling = () => {
      if (poll) clearInterval(poll)
      if (retry) clearTimeout(retry)
      poll = null
      retry = null
    }

    function connect() {
      if (disposed) return
      source?.close()
      source = new EventSource('/api/photo-queue/stream')

      source.addEventListener('open', () => {
        failures = 0
        stopPolling()
        setConnection('live')
      })

      source.addEventListener('queue.updated', (message) => {
        receive((message as MessageEvent<string>).data)
      })

      source.addEventListener('error', () => {
        failures += 1
        if (failures >= FAILURES_BEFORE_POLLING) {
          source?.close()
          source = null
          startPolling()
          return
        }
        // EventSource retries on its own; say so rather than pretending to be live.
        setConnection('reconnecting')
      })
    }

    connect()

    return () => {
      disposed = true
      stopPolling()
      source?.close()
    }
  }, [applySnapshot])

  return { snapshot, connection, applySnapshot }
}
