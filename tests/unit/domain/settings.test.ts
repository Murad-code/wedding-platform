import { describe, expect, it } from 'vitest'

import { DEFAULT_FEATURES } from '@/domain/wedding/features'
import { daysUntilWedding, isRsvpOpen, toWeddingSettingsView } from '@/domain/wedding/settings'

describe('toWeddingSettingsView', () => {
  it('reports an unconfigured wedding for an empty record', () => {
    const view = toWeddingSettingsView({})
    expect(view.isConfigured).toBe(false)
    expect(view.coupleNames).toBeNull()
    expect(view.features).toEqual(DEFAULT_FEATURES)
  })

  it('survives null, undefined, and non-object input', () => {
    for (const input of [null, undefined, 'nonsense', 42]) {
      expect(() => toWeddingSettingsView(input)).not.toThrow()
      expect(toWeddingSettingsView(input).isConfigured).toBe(false)
    }
  })

  it('requires both names and a date before it counts as configured', () => {
    expect(
      toWeddingSettingsView({ partnerOneName: 'Sarah', weddingDate: '2027-06-12T13:00:00Z' })
        .isConfigured,
    ).toBe(false)
    expect(
      toWeddingSettingsView({ partnerOneName: 'Sarah', partnerTwoName: 'Adam' }).isConfigured,
    ).toBe(false)
  })

  it('composes couple names', () => {
    const view = toWeddingSettingsView({
      partnerOneName: 'Sarah',
      partnerTwoName: 'Adam',
      weddingDate: '2027-06-12T13:00:00Z',
    })
    expect(view.coupleNames).toBe('Sarah & Adam')
    expect(view.isConfigured).toBe(true)
  })

  it('treats blank strings as absent', () => {
    const view = toWeddingSettingsView({ partnerOneName: '   ', dressCode: '' })
    expect(view.partnerOneName).toBeNull()
    expect(view.dressCode).toBeNull()
  })

  it('defaults the timezone rather than leaving it empty', () => {
    expect(toWeddingSettingsView({}).timezone).toBe('Europe/London')
    expect(toWeddingSettingsView({ timezone: 'America/New_York' }).timezone).toBe(
      'America/New_York',
    )
  })

  it('drops incomplete FAQ entries instead of rendering half a question', () => {
    const view = toWeddingSettingsView({
      faqs: [
        { question: 'Parking?', answer: 'Yes, on site.' },
        { question: 'Dogs?' },
        { answer: 'Orphaned answer' },
        null,
      ],
    })
    expect(view.faqs).toEqual([{ question: 'Parking?', answer: 'Yes, on site.' }])
  })

  it('normalises a missing venue group', () => {
    const view = toWeddingSettingsView({})
    expect(view.ceremony.venueName).toBeNull()
    expect(view.reception.mapUrl).toBeNull()
  })
})

describe('isRsvpOpen', () => {
  const base = toWeddingSettingsView({
    partnerOneName: 'Sarah',
    partnerTwoName: 'Adam',
    weddingDate: '2027-06-12T13:00:00Z',
  })

  it('is open when no deadline is set', () => {
    expect(isRsvpOpen(base, new Date('2027-01-01T00:00:00Z'))).toBe(true)
  })

  it('is open before the deadline and closed after it', () => {
    const settings = { ...base, rsvpDeadline: '2027-05-01T23:59:59Z' }
    expect(isRsvpOpen(settings, new Date('2027-04-30T12:00:00Z'))).toBe(true)
    expect(isRsvpOpen(settings, new Date('2027-05-02T00:00:00Z'))).toBe(false)
  })

  it('is closed when the RSVP feature is disabled, deadline notwithstanding', () => {
    const settings = { ...base, features: { ...base.features, rsvp: false } }
    expect(isRsvpOpen(settings, new Date('2027-01-01T00:00:00Z'))).toBe(false)
  })
})

describe('daysUntilWedding', () => {
  const settings = toWeddingSettingsView({ weddingDate: '2027-06-12T13:00:00Z' })

  it('returns null without a date', () => {
    expect(daysUntilWedding(toWeddingSettingsView({}))).toBeNull()
  })

  it('counts whole calendar days, not 24-hour blocks', () => {
    // Late the night before is still "1 day away", not 0.
    expect(daysUntilWedding(settings, new Date('2027-06-11T23:30:00Z'))).toBe(1)
    expect(daysUntilWedding(settings, new Date('2027-06-12T01:00:00Z'))).toBe(0)
  })

  it('goes negative after the wedding', () => {
    expect(daysUntilWedding(settings, new Date('2027-06-15T00:00:00Z'))).toBe(-3)
  })
})
