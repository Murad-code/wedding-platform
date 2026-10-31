import { describe, expect, it } from 'vitest'

import { BASELINE_CSP, generateNonce, pageCsp } from '@/domain/security/csp'

function directive(policy: string, name: string): string | undefined {
  return policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `))
}

const production = pageCsp({ nonce: 'abc123', isDevelopment: false })

describe('page policy', () => {
  it('only runs scripts that carry this request’s nonce', () => {
    expect(directive(production, 'script-src')).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
    )
  })

  it('never allows inline scripts, in any mode', () => {
    for (const isDevelopment of [false, true]) {
      const scripts = directive(pageCsp({ nonce: 'n', isDevelopment }), 'script-src') ?? ''
      expect(scripts).not.toContain("'unsafe-inline'")
    }
  })

  it('allows eval in development only', () => {
    expect(directive(production, 'script-src')).not.toContain("'unsafe-eval'")
    expect(directive(pageCsp({ nonce: 'n', isDevelopment: true }), 'script-src')).toContain(
      "'unsafe-eval'",
    )
  })

  it('never allows inline styles, in any mode', () => {
    for (const isDevelopment of [false, true]) {
      const policy = pageCsp({ nonce: 'n', isDevelopment })
      expect(directive(policy, 'style-src')).toBe("style-src 'self' 'nonce-n'")
      expect(policy).not.toContain('style-src-attr')
    }
  })

  it('keeps every baseline protection', () => {
    for (const part of BASELINE_CSP.split('; ')) {
      expect(production).toContain(part)
    }
  })

  it('loads nothing from another origin', () => {
    expect(production).not.toMatch(/https?:/)
  })
})

describe('generateNonce', () => {
  it('is different every time', () => {
    const nonces = new Set(Array.from({ length: 100 }, generateNonce))
    expect(nonces.size).toBe(100)
  })

  it('is base64 of 16 bytes, which is valid inside a CSP nonce source', () => {
    expect(generateNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/)
  })
})
