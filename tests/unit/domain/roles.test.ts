import { describe, expect, it } from 'vitest'

import { type Actor, canManageTeam, canMutate, canRead, isAdmin, isRole } from '@/domain/auth/roles'

const admin: Actor = { id: 1, role: 'admin' }
const organiser: Actor = { id: 2, role: 'organiser' }
const viewer: Actor = { id: 3, role: 'viewer' }
const anonymous: Actor = null

describe('isRole', () => {
  it('accepts known roles', () => {
    expect(isRole('admin')).toBe(true)
    expect(isRole('organiser')).toBe(true)
    expect(isRole('viewer')).toBe(true)
  })

  it('rejects anything else', () => {
    for (const value of ['superuser', '', 'ADMIN', null, undefined, 1, {}]) {
      expect(isRole(value)).toBe(false)
    }
  })
})

describe('permissions', () => {
  it('lets any signed-in role read', () => {
    expect(canRead(admin)).toBe(true)
    expect(canRead(organiser)).toBe(true)
    expect(canRead(viewer)).toBe(true)
  })

  it('never lets an anonymous visitor read, mutate, or administer', () => {
    expect(canRead(anonymous)).toBe(false)
    expect(canMutate(anonymous)).toBe(false)
    expect(isAdmin(anonymous)).toBe(false)
    expect(canManageTeam(anonymous)).toBe(false)
  })

  it('keeps viewers read-only', () => {
    expect(canRead(viewer)).toBe(true)
    expect(canMutate(viewer)).toBe(false)
    expect(canManageTeam(viewer)).toBe(false)
  })

  it('lets organisers mutate but not manage the team', () => {
    expect(canMutate(organiser)).toBe(true)
    expect(canManageTeam(organiser)).toBe(false)
    expect(isAdmin(organiser)).toBe(false)
  })

  it('gives admins everything', () => {
    expect(canMutate(admin)).toBe(true)
    expect(canManageTeam(admin)).toBe(true)
    expect(isAdmin(admin)).toBe(true)
  })
})
