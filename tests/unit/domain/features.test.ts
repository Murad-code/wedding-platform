import { describe, expect, it } from 'vitest'

import { DEFAULT_FEATURES, isFeatureEnabled, resolveFeatures } from '@/domain/wedding/features'

describe('resolveFeatures', () => {
  it('falls back to defaults when nothing is stored', () => {
    expect(resolveFeatures(undefined)).toEqual(DEFAULT_FEATURES)
    expect(resolveFeatures(null)).toEqual(DEFAULT_FEATURES)
  })

  it('keeps SMS off by default because it costs money and needs consent', () => {
    expect(DEFAULT_FEATURES.smsNotifications).toBe(false)
  })

  it('enables exactly what is stored', () => {
    const features = resolveFeatures(['rsvp', 'menu'])
    expect(features.rsvp).toBe(true)
    expect(features.menu).toBe(true)
    expect(features.seating).toBe(false)
    expect(features.photoQueue).toBe(false)
  })

  it('treats an empty stored array as everything disabled, not as unset', () => {
    const features = resolveFeatures([])
    expect(Object.values(features).every((enabled) => enabled === false)).toBe(true)
  })

  it('ignores unknown feature names', () => {
    const features = resolveFeatures(['rsvp', 'timeMachine'])
    expect(features.rsvp).toBe(true)
    expect(Object.keys(features)).not.toContain('timeMachine')
  })

  it('reports flags through isFeatureEnabled', () => {
    const features = resolveFeatures(['seating'])
    expect(isFeatureEnabled(features, 'seating')).toBe(true)
    expect(isFeatureEnabled(features, 'rsvp')).toBe(false)
  })
})
