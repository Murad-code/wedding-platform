import { describe, expect, it } from 'vitest'

import { createInMemoryRateLimiter } from '@/domain/rate-limit/limiter'

function fakeClock(start = 0) {
  let current = start
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms
    },
  }
}

describe('createInMemoryRateLimiter', () => {
  it('allows requests up to the limit', () => {
    const limiter = createInMemoryRateLimiter({ limit: 3, windowMs: 1000, now: () => 0 })

    expect(limiter.check('ip').allowed).toBe(true)
    expect(limiter.check('ip').allowed).toBe(true)
    expect(limiter.check('ip').allowed).toBe(true)
  })

  it('blocks once the limit is exceeded', () => {
    const limiter = createInMemoryRateLimiter({ limit: 2, windowMs: 1000, now: () => 0 })

    limiter.check('ip')
    limiter.check('ip')
    expect(limiter.check('ip').allowed).toBe(false)
  })

  it('reports remaining attempts', () => {
    const limiter = createInMemoryRateLimiter({ limit: 3, windowMs: 1000, now: () => 0 })

    expect(limiter.check('ip').remaining).toBe(2)
    expect(limiter.check('ip').remaining).toBe(1)
    expect(limiter.check('ip').remaining).toBe(0)
  })

  it('tracks keys independently, so one guest cannot lock out another', () => {
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 })

    expect(limiter.check('ip-a').allowed).toBe(true)
    expect(limiter.check('ip-a').allowed).toBe(false)
    expect(limiter.check('ip-b').allowed).toBe(true)
  })

  it('resets after the window elapses', () => {
    const clock = fakeClock()
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 1000, now: clock.now })

    expect(limiter.check('ip').allowed).toBe(true)
    expect(limiter.check('ip').allowed).toBe(false)

    clock.advance(1000)
    expect(limiter.check('ip').allowed).toBe(true)
  })

  it('does not reset early', () => {
    const clock = fakeClock()
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 1000, now: clock.now })

    limiter.check('ip')
    clock.advance(999)
    expect(limiter.check('ip').allowed).toBe(false)
  })

  it('reports how long to wait when blocked', () => {
    const clock = fakeClock()
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 5000, now: clock.now })

    limiter.check('ip')
    clock.advance(2000)
    expect(limiter.check('ip').retryAfterSeconds).toBe(3)
  })
})

describe('rate-limit shape for a wedding audience', () => {
  it('lets a whole venue share one address without locking anyone out', () => {
    // Guests are overwhelmingly behind one NAT — the venue wifi or a mobile carrier.
    // A ceiling sized for that must not trip on ordinary use.
    const limiter = createInMemoryRateLimiter({ limit: 300, windowMs: 60_000, now: () => 0 })

    for (let guest = 0; guest < 150; guest++) {
      expect(limiter.check('venue-nat').allowed).toBe(true)
    }
  })

  it('still stops scripted flooding from one address', () => {
    const limiter = createInMemoryRateLimiter({ limit: 300, windowMs: 60_000, now: () => 0 })
    for (let i = 0; i < 300; i++) limiter.check('attacker')
    expect(limiter.check('attacker').allowed).toBe(false)
  })

  it('throttles a hammered token without affecting another household', () => {
    const limiter = createInMemoryRateLimiter({ limit: 20, windowMs: 60_000, now: () => 0 })

    for (let i = 0; i < 20; i++) limiter.check('token-a')
    expect(limiter.check('token-a').allowed).toBe(false)
    // A different family's invitation is unaffected.
    expect(limiter.check('token-b').allowed).toBe(true)
  })
})
