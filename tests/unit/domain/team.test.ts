import { describe, expect, it } from 'vitest'

import { checkRemoval, checkRoleChange, type TeamMember } from '@/domain/auth/team'

const team: TeamMember[] = [
  { id: 1, role: 'admin' },
  { id: 2, role: 'admin' },
  { id: 3, role: 'organiser' },
  { id: 4, role: 'viewer' },
]

const soleAdmin: TeamMember[] = [
  { id: 1, role: 'admin' },
  { id: 3, role: 'organiser' },
]

describe('checkRoleChange', () => {
  it('lets an admin change someone else’s role', () => {
    expect(checkRoleChange(team, 1, 3, 'viewer')).toEqual({ ok: true })
  })

  it('lets an admin demote another admin while one admin remains', () => {
    expect(checkRoleChange(team, 1, 2, 'organiser')).toEqual({ ok: true })
  })

  it('refuses a change to your own role', () => {
    expect(checkRoleChange(team, 1, 1, 'viewer')).toMatchObject({ ok: false })
    expect(checkRoleChange(team, 1, 1, 'viewer')).toMatchObject({
      reason: expect.stringMatching(/own role/),
    })
  })

  it('refuses to demote the last admin, even from a script', () => {
    // No actor, so the self rule does not apply; the last-admin floor still does.
    expect(checkRoleChange(soleAdmin, null, 1, 'organiser')).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/at least one admin/),
    })
  })

  it('treats setting the same role as a no-op, even on yourself', () => {
    expect(checkRoleChange(team, 1, 1, 'admin')).toEqual({ ok: true })
  })

  it('refuses an account that does not exist', () => {
    expect(checkRoleChange(team, 1, 99, 'viewer')).toMatchObject({ ok: false })
  })

  it('matches ids across number and string, as Payload and form data disagree', () => {
    expect(checkRoleChange(team, '1', 1, 'viewer')).toMatchObject({ ok: false })
  })
})

describe('checkRemoval', () => {
  it('lets an admin remove someone else', () => {
    expect(checkRemoval(team, 1, 4)).toEqual({ ok: true })
  })

  it('lets an admin remove another admin while one admin remains', () => {
    expect(checkRemoval(team, 1, 2)).toEqual({ ok: true })
  })

  it('refuses removing your own account', () => {
    expect(checkRemoval(team, 3, 3)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/your own account/),
    })
  })

  it('refuses removing the last admin, even from a script', () => {
    expect(checkRemoval(soleAdmin, null, 1)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/at least one admin/),
    })
  })

  it('refuses an account that does not exist', () => {
    expect(checkRemoval(team, 1, 99)).toMatchObject({ ok: false })
  })
})
