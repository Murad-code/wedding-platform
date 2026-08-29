import { describe, expect, it } from 'vitest'

import {
  generateInvitationToken,
  hashInvitationToken,
  isPlausibleToken,
  redactToken,
} from '@/domain/invitations/token'

describe('generateInvitationToken', () => {
  it('produces a 43-character base64url string (256 bits)', () => {
    const token = generateInvitationToken()
    expect(token).toHaveLength(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('is URL-safe — no characters needing encoding in a path segment', () => {
    for (let i = 0; i < 50; i++) {
      const token = generateInvitationToken()
      expect(encodeURIComponent(token)).toBe(token)
    }
  })

  it('never repeats across many generations', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateInvitationToken))
    expect(tokens.size).toBe(1000)
  })
})

describe('hashInvitationToken', () => {
  it('is deterministic', () => {
    const token = generateInvitationToken()
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token))
  })

  it('never contains the token', () => {
    const token = generateInvitationToken()
    expect(hashInvitationToken(token)).not.toContain(token)
  })

  it('produces a 64-character hex digest', () => {
    expect(hashInvitationToken('anything')).toMatch(/^[a-f0-9]{64}$/)
  })

  it('gives different hashes for different tokens', () => {
    expect(hashInvitationToken(generateInvitationToken())).not.toBe(
      hashInvitationToken(generateInvitationToken()),
    )
  })
})

describe('isPlausibleToken', () => {
  it('accepts a generated token', () => {
    expect(isPlausibleToken(generateInvitationToken())).toBe(true)
  })

  it('rejects wrong lengths', () => {
    expect(isPlausibleToken('')).toBe(false)
    expect(isPlausibleToken('a'.repeat(42))).toBe(false)
    expect(isPlausibleToken('a'.repeat(44))).toBe(false)
  })

  it('rejects characters outside base64url', () => {
    expect(isPlausibleToken(`${'a'.repeat(42)}+`)).toBe(false)
    expect(isPlausibleToken(`${'a'.repeat(42)}/`)).toBe(false)
    expect(isPlausibleToken(`${'a'.repeat(42)}=`)).toBe(false)
  })

  it('rejects injection and traversal attempts without a database hit', () => {
    expect(isPlausibleToken("' OR 1=1--")).toBe(false)
    expect(isPlausibleToken('../../etc/passwd')).toBe(false)
    expect(isPlausibleToken('<script>alert(1)</script>')).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isPlausibleToken(null)).toBe(false)
    expect(isPlausibleToken(undefined)).toBe(false)
    expect(isPlausibleToken(42)).toBe(false)
    expect(isPlausibleToken({})).toBe(false)
  })
})

describe('redactToken', () => {
  it('never returns any part of the token', () => {
    const token = generateInvitationToken()
    const redacted = redactToken(token)
    expect(redacted).not.toContain(token)
    expect(redacted).not.toContain(token.slice(0, 8))
  })
})
