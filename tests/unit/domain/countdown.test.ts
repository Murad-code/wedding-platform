import { describe, expect, it } from 'vitest'

import {
  calendarDateInZone,
  calendarDaysUntil,
  countdownTo,
  formatWeddingDate,
  formatWeddingTime,
} from '@/domain/wedding/countdown'

describe('calendarDateInZone', () => {
  it('gives the local calendar date, not the UTC one', () => {
    // 00:30 UTC on 13 June is still the evening of 12 June in Los Angeles.
    const instant = new Date('2027-06-13T00:30:00Z')
    expect(calendarDateInZone(instant, 'UTC')).toBe('2027-06-13')
    expect(calendarDateInZone(instant, 'America/Los_Angeles')).toBe('2027-06-12')
    expect(calendarDateInZone(instant, 'Pacific/Auckland')).toBe('2027-06-13')
  })

  it('falls back to UTC for an invalid timezone rather than throwing', () => {
    expect(calendarDateInZone(new Date('2027-06-12T12:00:00Z'), 'Not/AZone')).toBe('2027-06-12')
  })
})

describe('calendarDaysUntil', () => {
  const london = 'Europe/London'

  it('returns null without a date', () => {
    expect(calendarDaysUntil(null, london)).toBeNull()
  })

  it('returns null for an unparseable date', () => {
    expect(calendarDaysUntil('not-a-date', london)).toBeNull()
  })

  it('is 0 on the wedding day itself', () => {
    expect(
      calendarDaysUntil('2027-06-12T13:00:00Z', london, new Date('2027-06-12T06:00:00Z')),
    ).toBe(0)
  })

  it('counts calendar days, not 24-hour blocks', () => {
    // 23:00 on 11 June in London (BST, UTC+1) is "1 day to go", even though the ceremony
    // is only 15 hours away. Note 23:30Z would already be 00:30 on the 12th locally —
    // exactly the confusion this function exists to remove.
    expect(
      calendarDaysUntil('2027-06-12T13:00:00Z', london, new Date('2027-06-11T22:00:00Z')),
    ).toBe(1)
  })

  it('rolls over at local midnight, not at UTC midnight', () => {
    const ceremony = '2027-06-12T13:00:00Z'
    // 22:00Z is 23:00 on the 11th in London; 23:30Z is 00:30 on the 12th.
    expect(calendarDaysUntil(ceremony, london, new Date('2027-06-11T22:00:00Z'))).toBe(1)
    expect(calendarDaysUntil(ceremony, london, new Date('2027-06-11T23:30:00Z'))).toBe(0)
  })

  it('goes negative after the wedding', () => {
    expect(
      calendarDaysUntil('2027-06-12T13:00:00Z', london, new Date('2027-06-15T00:00:00Z')),
    ).toBe(-3)
  })

  it('counts in the wedding timezone, not UTC', () => {
    // A 17:00 ceremony in Los Angeles is 00:00 UTC the *next* day. Counting in UTC
    // would tell a guest looking at it that morning that it is tomorrow.
    const ceremony = '2027-06-13T00:00:00Z' // 17:00 on 12 June in Los Angeles
    const thatMorning = new Date('2027-06-12T17:00:00Z') // 10:00 on 12 June in LA

    expect(calendarDaysUntil(ceremony, 'America/Los_Angeles', thatMorning)).toBe(0)
    // The same instants counted in UTC would be off by one, which is the bug.
    expect(calendarDaysUntil(ceremony, 'UTC', thatMorning)).toBe(1)
  })

  it('handles a timezone ahead of UTC', () => {
    // 10:00 on 12 June in Auckland is 22:00 UTC on 11 June.
    const ceremony = '2027-06-11T22:00:00Z'
    const sameMorning = new Date('2027-06-11T20:00:00Z') // 08:00 on 12 June in Auckland
    expect(calendarDaysUntil(ceremony, 'Pacific/Auckland', sameMorning)).toBe(0)
  })

  it('is unaffected by a daylight-saving transition in between', () => {
    // UK clocks go forward on 26 March 2028; the calendar-day count must still be exact.
    expect(
      calendarDaysUntil('2028-03-27T12:00:00Z', 'Europe/London', new Date('2028-03-25T12:00:00Z')),
    ).toBe(2)
  })
})

describe('countdownTo', () => {
  it('returns null without a date', () => {
    expect(countdownTo(null)).toBeNull()
  })

  it('breaks the remaining time into days, hours, and minutes', () => {
    const result = countdownTo('2027-06-12T13:00:00Z', new Date('2027-06-10T11:30:00Z'))
    expect(result).toEqual({ days: 2, hours: 1, minutes: 30, isPast: false })
  })

  it('reports the wedding as past once it has started', () => {
    const result = countdownTo('2027-06-12T13:00:00Z', new Date('2027-06-12T13:00:01Z'))
    expect(result?.isPast).toBe(true)
    expect(result?.days).toBe(0)
  })

  it('treats the exact moment as past rather than showing zeroes counting down', () => {
    expect(countdownTo('2027-06-12T13:00:00Z', new Date('2027-06-12T13:00:00Z'))?.isPast).toBe(true)
  })
})

describe('formatWeddingDate', () => {
  it('formats in the wedding timezone', () => {
    expect(formatWeddingDate('2027-06-12T13:00:00Z', 'Europe/London')).toBe(
      'Saturday, 12 June 2027',
    )
  })

  it('shows the couple’s date, not the viewer’s', () => {
    // 00:30 UTC on 13 June is Saturday 12 June where the wedding is.
    expect(formatWeddingDate('2027-06-13T00:30:00Z', 'America/Los_Angeles')).toBe(
      'Saturday, 12 June 2027',
    )
  })

  it('returns null for missing or invalid input', () => {
    expect(formatWeddingDate(null, 'Europe/London')).toBeNull()
    expect(formatWeddingDate('nonsense', 'Europe/London')).toBeNull()
  })
})

describe('formatWeddingTime', () => {
  it('formats the local ceremony time', () => {
    expect(formatWeddingTime('2027-06-12T13:00:00Z', 'Europe/London')).toBe('2:00 pm')
  })

  it('shows the ceremony time the couple meant, wherever the guest is', () => {
    expect(formatWeddingTime('2027-06-13T00:00:00Z', 'America/Los_Angeles')).toBe('5:00 pm')
  })

  it('returns null for missing or invalid input', () => {
    expect(formatWeddingTime(null, 'Europe/London')).toBeNull()
    expect(formatWeddingTime('nonsense', 'Europe/London')).toBeNull()
  })
})
