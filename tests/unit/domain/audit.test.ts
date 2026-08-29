import { describe, expect, it } from 'vitest'

import { hashIp, sanitiseMetadata } from '@/domain/audit/record'

describe('hashIp', () => {
  it('returns null when there is no address', () => {
    expect(hashIp(null, 'salt')).toBeNull()
    expect(hashIp(undefined, 'salt')).toBeNull()
    expect(hashIp('', 'salt')).toBeNull()
  })

  it('never returns the address itself', () => {
    const hashed = hashIp('203.0.113.5', 'salt')
    expect(hashed).not.toBeNull()
    expect(hashed).not.toContain('203.0.113.5')
  })

  it('is stable for the same address and salt', () => {
    expect(hashIp('203.0.113.5', 'salt')).toBe(hashIp('203.0.113.5', 'salt'))
  })

  it('differs across deployments so hashes cannot be correlated between weddings', () => {
    expect(hashIp('203.0.113.5', 'wedding-a')).not.toBe(hashIp('203.0.113.5', 'wedding-b'))
  })
})

describe('sanitiseMetadata', () => {
  it('passes through safe context', () => {
    expect(sanitiseMetadata({ guestCount: 4, partyId: 'abc' })).toEqual({
      guestCount: 4,
      partyId: 'abc',
    })
  })

  it('strips invitation tokens', () => {
    const safe = sanitiseMetadata({ token: 'secret-token', tokenHash: 'abc', partyId: '1' })
    expect(safe).not.toHaveProperty('token')
    expect(safe).not.toHaveProperty('tokenHash')
    expect(safe).toEqual({ partyId: '1' })
  })

  it('strips guest PII and special-category data', () => {
    const safe = sanitiseMetadata({
      email: 'a@b.c',
      phone: '+447700900000',
      allergies: 'peanuts',
      dietaryRequirements: 'coeliac',
      accessibilityNeeds: 'step-free access',
      action: 'kept',
    })
    expect(safe).toEqual({ action: 'kept' })
  })

  it('matches keys case-insensitively', () => {
    expect(sanitiseMetadata({ Token: 'x', EMAIL: 'y', ok: 1 })).toEqual({ ok: 1 })
  })

  it('returns undefined when there is no metadata', () => {
    expect(sanitiseMetadata(undefined)).toBeUndefined()
  })
})
