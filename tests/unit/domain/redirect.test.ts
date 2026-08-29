import { describe, expect, it } from 'vitest'

import { sanitiseRedirect } from '@/domain/auth/redirect'

describe('sanitiseRedirect', () => {
  it('keeps same-site absolute paths', () => {
    expect(sanitiseRedirect('/dashboard/guests')).toBe('/dashboard/guests')
    expect(sanitiseRedirect('/dashboard?filter=attending')).toBe('/dashboard?filter=attending')
  })

  it('falls back when nothing usable is supplied', () => {
    expect(sanitiseRedirect(undefined)).toBe('/dashboard')
    expect(sanitiseRedirect(null)).toBe('/dashboard')
    expect(sanitiseRedirect('')).toBe('/dashboard')
    expect(sanitiseRedirect(42)).toBe('/dashboard')
  })

  it('refuses absolute URLs to other origins', () => {
    expect(sanitiseRedirect('https://evil.example/login')).toBe('/dashboard')
    expect(sanitiseRedirect('http://evil.example')).toBe('/dashboard')
    expect(sanitiseRedirect('javascript:alert(1)')).toBe('/dashboard')
  })

  it('refuses protocol-relative URLs', () => {
    // The classic open-redirect bypass: "//evil.example" is a URL, not a path.
    expect(sanitiseRedirect('//evil.example')).toBe('/dashboard')
    expect(sanitiseRedirect('/\\evil.example')).toBe('/dashboard')
  })

  it('refuses control characters used to split URLs', () => {
    expect(sanitiseRedirect('/dashboard\nSet-Cookie: x=1')).toBe('/dashboard')
    expect(sanitiseRedirect('/dashboard\r\nLocation: https://evil.example')).toBe('/dashboard')
    expect(sanitiseRedirect('/dashboard\u0000')).toBe('/dashboard')
  })

  it('honours a custom fallback', () => {
    expect(sanitiseRedirect('https://evil.example', '/login')).toBe('/login')
  })
})
