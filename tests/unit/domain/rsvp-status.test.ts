import { describe, expect, it } from 'vitest'

import { derivePartyStatus, isRsvpStatus, tallyRsvps } from '@/domain/rsvp/status'

describe('derivePartyStatus', () => {
  it('is pending for a party with no guests', () => {
    expect(derivePartyStatus([])).toBe('pending')
  })

  it('is pending when nobody has answered', () => {
    expect(derivePartyStatus(['pending', 'pending', 'pending'])).toBe('pending')
  })

  it('is partial when only some have answered', () => {
    // The normal case for a household: one parent answers, the rest follow later.
    expect(derivePartyStatus(['attending', 'pending'])).toBe('partial')
    expect(derivePartyStatus(['declined', 'pending', 'pending'])).toBe('partial')
  })

  it('is complete when everyone has answered', () => {
    expect(derivePartyStatus(['attending', 'declined'])).toBe('complete')
    expect(derivePartyStatus(['attending'])).toBe('complete')
  })

  it('is complete when everyone declined, so the chase list stops nagging them', () => {
    expect(derivePartyStatus(['declined', 'declined'])).toBe('complete')
  })

  it('handles partial household attendance, the common real-world case', () => {
    // Two parents come, both children cannot.
    expect(derivePartyStatus(['attending', 'attending', 'declined', 'declined'])).toBe('complete')
  })
})

describe('tallyRsvps', () => {
  it('counts an empty guest list as all zeroes', () => {
    expect(tallyRsvps([])).toEqual({ invited: 0, attending: 0, declined: 0, pending: 0 })
  })

  it('counts each status and totals the invited', () => {
    expect(tallyRsvps(['attending', 'attending', 'declined', 'pending'])).toEqual({
      invited: 4,
      attending: 2,
      declined: 1,
      pending: 1,
    })
  })

  it('keeps invited equal to the sum of the parts', () => {
    const totals = tallyRsvps(['attending', 'declined', 'pending', 'pending', 'attending'])
    expect(totals.attending + totals.declined + totals.pending).toBe(totals.invited)
  })
})

describe('isRsvpStatus', () => {
  it('accepts the known statuses', () => {
    expect(isRsvpStatus('pending')).toBe(true)
    expect(isRsvpStatus('attending')).toBe(true)
    expect(isRsvpStatus('declined')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isRsvpStatus('maybe')).toBe(false)
    expect(isRsvpStatus('Attending')).toBe(false)
    expect(isRsvpStatus(null)).toBe(false)
    expect(isRsvpStatus(1)).toBe(false)
  })
})
