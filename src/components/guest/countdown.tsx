'use client'

import { useCallback, useRef, useSyncExternalStore } from 'react'

import { countdownTo, type Countdown as CountdownValue } from '@/domain/wedding/countdown'
import { cn } from '@/lib/cn'

/**
 * Subscribes to the clock, ticking once a minute.
 *
 * `useSyncExternalStore` is the sanctioned way to read a changing external value in a
 * way that is safe across server rendering and hydration: `getServerSnapshot` returns
 * null so the server and the first client render agree, and the real time arrives on the
 * following render. A `useEffect` + `setState` would work but sets state synchronously
 * during the effect, which cascades renders.
 *
 * The snapshot is cached in a ref because `getSnapshot` must return a stable value
 * between calls — returning `Date.now()` directly would re-render forever.
 *
 * A minute, not a second: a ticking seconds display buys nothing at this timescale and
 * sits badly with `prefers-reduced-motion`.
 */
function useMinuteTick(): number | null {
  const cached = useRef<number | null>(null)

  const subscribe = useCallback((onChange: () => void) => {
    const timer = setInterval(() => {
      cached.current = Date.now()
      onChange()
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  const getSnapshot = useCallback(() => {
    cached.current ??= Date.now()
    return cached.current
  }, [])

  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

export function Countdown({
  weddingDate,
  className,
}: {
  weddingDate: string | null
  className?: string
}) {
  const now = useMinuteTick()

  if (!weddingDate) return null

  const value: CountdownValue | null = now === null ? null : countdownTo(weddingDate, new Date(now))

  // Reserve the space so the layout does not jump when the value arrives.
  if (!value) {
    return <div className={cn('h-20', className)} aria-hidden="true" />
  }

  if (value.isPast) {
    return (
      <p className={cn('font-guest-display text-2xl', className)}>
        Thank you for celebrating with us
      </p>
    )
  }

  return (
    <div className={className}>
      <dl className="flex items-end justify-center gap-8" aria-label="Time until the wedding">
        <Unit value={value.days} label={value.days === 1 ? 'day' : 'days'} />
        <Unit value={value.hours} label={value.hours === 1 ? 'hour' : 'hours'} />
        <Unit value={value.minutes} label={value.minutes === 1 ? 'minute' : 'minutes'} />
      </dl>
    </div>
  )
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <dd className="font-guest-display text-4xl tabular-nums sm:text-5xl">{value}</dd>
      <dt className="mt-1 text-xs tracking-[0.2em] text-guest-muted uppercase">{label}</dt>
    </div>
  )
}
