import { describe, expect, it } from 'vitest'

import { guestsBelongToParty, rsvpSubmissionSchema } from '@/domain/rsvp/schema'

const validGuest = {
  guestId: 1,
  rsvpStatus: 'attending',
  dietaryRequirements: 'Vegetarian',
  allergies: '',
  accessibilityNeeds: '',
}

describe('rsvpSubmissionSchema', () => {
  it('accepts a well-formed submission', () => {
    const result = rsvpSubmissionSchema.safeParse({
      guests: [validGuest],
      messageToCouple: 'Congratulations!',
      contactEmail: 'guest@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('requires at least one guest response', () => {
    expect(rsvpSubmissionSchema.safeParse({ guests: [] }).success).toBe(false)
  })

  it('refuses a status of "pending" so a guest cannot escape the chase list', () => {
    const result = rsvpSubmissionSchema.safeParse({
      guests: [{ ...validGuest, rsvpStatus: 'pending' }],
    })
    expect(result.success).toBe(false)
  })

  it('refuses an unknown status', () => {
    expect(
      rsvpSubmissionSchema.safeParse({ guests: [{ ...validGuest, rsvpStatus: 'maybe' }] }).success,
    ).toBe(false)
  })

  it('refuses a non-numeric or negative guest id', () => {
    expect(
      rsvpSubmissionSchema.safeParse({ guests: [{ ...validGuest, guestId: 'abc' }] }).success,
    ).toBe(false)
    expect(
      rsvpSubmissionSchema.safeParse({ guests: [{ ...validGuest, guestId: -1 }] }).success,
    ).toBe(false)
  })

  it('caps free text so a submission cannot be used to bloat storage', () => {
    const result = rsvpSubmissionSchema.safeParse({
      guests: [{ ...validGuest, dietaryRequirements: 'a'.repeat(501) }],
    })
    expect(result.success).toBe(false)
  })

  it('normalises blank free text to null rather than storing empty strings', () => {
    const result = rsvpSubmissionSchema.safeParse({
      guests: [{ ...validGuest, dietaryRequirements: '   ' }],
      messageToCouple: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.guests[0]?.dietaryRequirements).toBeNull()
      expect(result.data.messageToCouple).toBeNull()
    }
  })

  it('rejects a malformed email but allows it to be omitted', () => {
    expect(
      rsvpSubmissionSchema.safeParse({ guests: [validGuest], contactEmail: 'not-an-email' })
        .success,
    ).toBe(false)
    expect(rsvpSubmissionSchema.safeParse({ guests: [validGuest] }).success).toBe(true)
  })
})

describe('guestsBelongToParty', () => {
  it('accepts guests from the resolved party', () => {
    expect(guestsBelongToParty([{ guestId: 1 }, { guestId: 2 }], [1, 2, 3])).toBe(true)
  })

  it('rejects a guest id from another party', () => {
    // The token proves which party you are, not which guests you may write.
    expect(guestsBelongToParty([{ guestId: 1 }, { guestId: 99 }], [1, 2, 3])).toBe(false)
  })

  it('rejects everything when the party has no guests', () => {
    expect(guestsBelongToParty([{ guestId: 1 }], [])).toBe(false)
  })

  it('accepts an empty submission vacuously', () => {
    expect(guestsBelongToParty([], [1, 2])).toBe(true)
  })
})
