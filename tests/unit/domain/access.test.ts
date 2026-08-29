import { describe, expect, it } from 'vitest'

import { toActor } from '@/domain/auth/access'

describe('toActor', () => {
  it('maps a valid Payload user', () => {
    expect(toActor({ id: 7, role: 'organiser', email: 'a@b.c' })).toEqual({
      id: 7,
      role: 'organiser',
    })
  })

  it('accepts string ids', () => {
    expect(toActor({ id: 'abc', role: 'admin' })).toEqual({ id: 'abc', role: 'admin' })
  })

  it('returns null for anything that is not a usable user', () => {
    // An unrecognised role must not fall through as a privileged actor.
    expect(toActor({ id: 1, role: 'superuser' })).toBeNull()
    expect(toActor({ id: 1 })).toBeNull()
    expect(toActor({ role: 'admin' })).toBeNull()
    expect(toActor({ id: null, role: 'admin' })).toBeNull()
    expect(toActor(null)).toBeNull()
    expect(toActor(undefined)).toBeNull()
    expect(toActor('admin')).toBeNull()
  })
})
