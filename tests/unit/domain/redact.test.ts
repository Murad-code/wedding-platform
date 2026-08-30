import { describe, expect, it } from 'vitest'

import {
  isSensitiveKey,
  redact,
  redactString,
  REDACTED,
  TOKEN_REDACTED,
} from '@/domain/logging/redact'

const token = 'rOHTjF42WdVkX8wILbWoeitKHjI_XXrQqhxTFRWkkCE'

describe('isSensitiveKey', () => {
  it('catches the obvious ones', () => {
    for (const key of ['password', 'PAYLOAD_SECRET', 'authorization', 'apiKey', 'cookie']) {
      expect(isSensitiveKey(key)).toBe(true)
    }
  })

  it('catches guest contact and special-category fields', () => {
    // Dietary, allergy, and accessibility data is special-category under GDPR.
    for (const key of ['contactEmail', 'guest_phone', 'dietaryRequirements', 'allergies']) {
      expect(isSensitiveKey(key)).toBe(true)
    }
  })

  it('matches however the key is spelled', () => {
    expect(isSensitiveKey('tokenHash')).toBe(true)
    expect(isSensitiveKey('invitation_token')).toBe(true)
    expect(isSensitiveKey('EMAIL')).toBe(true)
  })

  it('leaves ordinary keys alone, or a log says nothing at all', () => {
    for (const key of ['action', 'revision', 'guestId', 'status', 'count']) {
      expect(isSensitiveKey(key)).toBe(false)
    }
  })
})

describe('redactString', () => {
  it('removes an invitation token from a URL', () => {
    // The commonest way a token would reach a log: inside an error message.
    expect(redactString(`GET /invite/${token} failed`)).toBe(`GET /invite/${TOKEN_REDACTED} failed`)
  })

  it('removes a token from the photo queue URL too', () => {
    expect(redactString(`/photos/${token}`)).not.toContain(token)
  })

  it('removes an email address', () => {
    expect(redactString('could not reach ada@example.test')).toBe(`could not reach ${REDACTED}`)
  })

  it('removes a phone number, however it is spaced', () => {
    expect(redactString('rang +44 7700 900123 twice')).toBe(`rang ${REDACTED} twice`)
    expect(redactString('07700900123')).toBe(REDACTED)
  })

  it('leaves ordinary text untouched', () => {
    const message = 'Photo queue: could not queue alerts'
    expect(redactString(message)).toBe(message)
  })

  it('does not mistake a short id for a token', () => {
    expect(redactString('group 1234 advanced')).toBe('group 1234 advanced')
  })

  it('leaves a versioned package path in a stack trace readable', () => {
    // Over-redaction is the safe direction, but an unreadable stack is its own failure.
    const path = 'node_modules/.pnpm/@vitest+runner@4.1.11/dist/chunk.js'
    expect(redactString(path)).toBe(path)
  })
})

describe('redact', () => {
  it('replaces the value of a sensitive key without hiding that it was there', () => {
    // Knowing a password field was present is useful; knowing its value is a breach.
    expect(redact({ password: 'hunter2', action: 'login' })).toEqual({
      password: REDACTED,
      action: 'login',
    })
  })

  it('redacts inside nested objects', () => {
    expect(redact({ user: { email: 'ada@example.test', id: 3 } })).toEqual({
      user: { email: REDACTED, id: 3 },
    })
  })

  it('redacts a token that arrives as an ordinary value', () => {
    expect(redact({ url: `/invite/${token}` })).toEqual({ url: `/invite/${TOKEN_REDACTED}` })
  })

  it('keeps errors legible while redacting their message', () => {
    const result = redact(new Error(`token ${token} rejected`)) as { message: string; name: string }
    expect(result.name).toBe('Error')
    expect(result.message).toContain(TOKEN_REDACTED)
    expect(result.message).not.toContain(token)
  })

  it('survives a circular object rather than hanging', () => {
    const node: Record<string, unknown> = { name: 'a' }
    node.self = node
    expect(redact(node)).toEqual({ name: 'a', self: '[circular]' })
  })

  it('stops descending rather than following an unbounded structure', () => {
    let deep: Record<string, unknown> = { value: 'bottom' }
    for (let i = 0; i < 10; i += 1) deep = { nested: deep }

    expect(JSON.stringify(redact(deep))).toContain('[depth-limit]')
  })

  it('truncates a very long array instead of logging all of it', () => {
    const result = redact(Array.from({ length: 200 }, (_, i) => i)) as unknown[]
    expect(result).toHaveLength(51)
    expect(result.at(-1)).toBe('…and 150 more')
  })

  it('truncates an enormous string', () => {
    const result = redact('x'.repeat(5_000)) as string
    expect(result.endsWith('…[truncated]')).toBe(true)
    expect(result.length).toBeLessThan(2_100)
  })

  it('passes ordinary scalars straight through', () => {
    expect(redact({ count: 3, ok: true, missing: null })).toEqual({
      count: 3,
      ok: true,
      missing: null,
    })
  })

  it('does not try to log a function', () => {
    expect(redact({ callback: () => undefined })).toEqual({ callback: '[omitted]' })
  })

  it('redacts inside an array of objects', () => {
    expect(redact([{ email: 'a@b.test' }, { email: 'c@d.test' }])).toEqual([
      { email: REDACTED },
      { email: REDACTED },
    ])
  })
})
