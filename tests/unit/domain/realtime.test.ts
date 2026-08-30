import { describe, expect, it, vi } from 'vitest'

import { createInProcessTransport } from '@/domain/realtime/transport'

const event = (revision: number) => ({ name: 'queue.updated', revision, data: { revision } })

describe('in-process transport', () => {
  it('delivers an event to every subscriber', () => {
    const transport = createInProcessTransport()
    const first = vi.fn()
    const second = vi.fn()

    transport.subscribe(first)
    transport.subscribe(second)
    transport.publish(event(1))

    expect(first).toHaveBeenCalledWith(event(1))
    expect(second).toHaveBeenCalledWith(event(1))
  })

  it('stops delivering once a subscriber unsubscribes', () => {
    const transport = createInProcessTransport()
    const listener = vi.fn()

    const unsubscribe = transport.subscribe(listener)
    unsubscribe()
    transport.publish(event(1))

    expect(listener).not.toHaveBeenCalled()
    expect(transport.subscriberCount).toBe(0)
  })

  it('is safe to unsubscribe twice', () => {
    const transport = createInProcessTransport()
    const unsubscribe = transport.subscribe(vi.fn())

    unsubscribe()
    expect(() => unsubscribe()).not.toThrow()
  })

  it('keeps delivering to everyone else when one subscriber throws', () => {
    // A guest whose connection is half-closed must not freeze the queue for the room.
    const onError = vi.fn()
    const transport = createInProcessTransport(onError)
    const healthy = vi.fn()

    transport.subscribe(() => {
      throw new Error('connection closed')
    })
    transport.subscribe(healthy)
    transport.publish(event(1))

    expect(healthy).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledOnce()
  })

  it('survives a subscriber that unsubscribes while being notified', () => {
    // Precisely what a closing SSE connection does.
    const transport = createInProcessTransport()
    const second = vi.fn()

    const unsubscribe = transport.subscribe(() => unsubscribe())
    transport.subscribe(second)

    expect(() => transport.publish(event(1))).not.toThrow()
    expect(second).toHaveBeenCalledOnce()
    expect(transport.subscriberCount).toBe(1)
  })

  it('publishing with nobody listening is not an error', () => {
    const transport = createInProcessTransport()
    expect(() => transport.publish(event(1))).not.toThrow()
  })
})
