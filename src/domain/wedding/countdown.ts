/**
 * Wedding-date arithmetic, evaluated in the *wedding's* timezone.
 *
 * Guests travel. Someone opening the site from New York must see the ceremony time the
 * couple actually meant, and "2 days to go" must mean two days in the wedding's calendar,
 * not the viewer's and not UTC's (docs/UX.md §8).
 */

/**
 * The calendar date at an instant, in a given timezone, as `YYYY-MM-DD`.
 *
 * `en-CA` is used because it formats as ISO-ordered `YYYY-MM-DD`, which sorts and parses
 * without further work.
 */
export function calendarDateInZone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    // An invalid IANA name must not take the page down; fall back to UTC.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  }
}

function toUtcMidnight(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

const MS_PER_DAY = 86_400_000

/**
 * Whole calendar days from now until the wedding, counted in the wedding's timezone.
 *
 * Counting in UTC instead is wrong wherever the wedding is not near UTC: a 17:00 ceremony
 * in Los Angeles falls on the *next* UTC date, so a guest looking at it that same morning
 * would be told it is tomorrow.
 *
 * Returns 0 on the day itself and negative numbers afterwards.
 */
export function calendarDaysUntil(
  targetIso: string | null,
  timezone: string,
  now: Date = new Date(),
): number | null {
  if (!targetIso) return null

  const target = new Date(targetIso)
  if (Number.isNaN(target.getTime())) return null

  const targetDay = toUtcMidnight(calendarDateInZone(target, timezone))
  const today = toUtcMidnight(calendarDateInZone(now, timezone))

  return Math.round((targetDay - today) / MS_PER_DAY)
}

export type Countdown = {
  days: number
  hours: number
  minutes: number
  isPast: boolean
}

/**
 * Time remaining until an instant, broken into parts.
 *
 * This is a straight difference between two instants, so no timezone is involved —
 * an instant is the same moment everywhere. Seconds are deliberately omitted: a
 * ticking seconds counter forces a re-render every second for no real benefit, and
 * it is hostile to `prefers-reduced-motion`.
 */
export function countdownTo(targetIso: string | null, now: Date = new Date()): Countdown | null {
  if (!targetIso) return null

  const target = new Date(targetIso)
  if (Number.isNaN(target.getTime())) return null

  const remaining = target.getTime() - now.getTime()
  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, isPast: true }
  }

  return {
    days: Math.floor(remaining / MS_PER_DAY),
    hours: Math.floor((remaining % MS_PER_DAY) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    isPast: false,
  }
}

/** Long date, e.g. "Saturday, 12 June 2027", rendered in the wedding's timezone. */
export function formatWeddingDate(iso: string | null, timezone: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null

  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone,
    }).format(date)
  } catch {
    return null
  }
}

/** Time of day, e.g. "1:00 pm", rendered in the wedding's timezone. */
export function formatWeddingTime(iso: string | null, timezone: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null

  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    })
      .format(date)
      .replace(/\s?([ap])m/i, (_match, meridiem: string) => ` ${meridiem.toLowerCase()}m`)
  } catch {
    return null
  }
}
