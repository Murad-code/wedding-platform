import { describe, expect, it } from 'vitest'

import { isProduction } from '@/lib/env'

describe('isProduction', () => {
  it('is false under the test environment', () => {
    expect(isProduction()).toBe(false)
  })
})
