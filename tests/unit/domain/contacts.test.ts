import { describe, expect, it } from 'vitest'

import {
  guestVisibleContacts,
  hasContactMethod,
  mailtoHref,
  telHref,
  whatsappHref,
  type WeddingContact,
} from '@/domain/contacts/contact'

function contact(partial: Partial<WeddingContact> & { id: number }): WeddingContact {
  return {
    name: `Contact ${partial.id}`,
    role: null,
    phone: null,
    whatsapp: null,
    email: null,
    visibleToGuests: true,
    order: 0,
    ...partial,
  }
}

describe('guestVisibleContacts', () => {
  it('hides contacts not marked visible', () => {
    // Supplier numbers live in the same collection and must not reach guests.
    const result = guestVisibleContacts([
      contact({ id: 1, visibleToGuests: true }),
      contact({ id: 2, visibleToGuests: false }),
    ])
    expect(result.map((c) => c.id)).toEqual([1])
  })

  it('orders by the order field', () => {
    const result = guestVisibleContacts([
      contact({ id: 1, order: 20 }),
      contact({ id: 2, order: 10 }),
    ])
    expect(result.map((c) => c.id)).toEqual([2, 1])
  })

  it('falls back to name when order ties', () => {
    const result = guestVisibleContacts([
      contact({ id: 1, name: 'Zoe', order: 0 }),
      contact({ id: 2, name: 'Adam', order: 0 }),
    ])
    expect(result.map((c) => c.name)).toEqual(['Adam', 'Zoe'])
  })

  it('returns an empty list when nothing is visible', () => {
    expect(guestVisibleContacts([contact({ id: 1, visibleToGuests: false })])).toEqual([])
  })
})

describe('hasContactMethod', () => {
  it('is false when there is no way to reach the person', () => {
    expect(hasContactMethod(contact({ id: 1 }))).toBe(false)
  })

  it('is true when any method exists', () => {
    expect(hasContactMethod(contact({ id: 1, phone: '01234' }))).toBe(true)
    expect(hasContactMethod(contact({ id: 1, whatsapp: '+44123' }))).toBe(true)
    expect(hasContactMethod(contact({ id: 1, email: 'a@b.c' }))).toBe(true)
  })
})

describe('link helpers', () => {
  it('strips formatting from tel links but keeps a leading plus', () => {
    // Organisers type numbers however they like.
    expect(telHref('+44 20 7946 0958')).toBe('tel:+442079460958')
    expect(telHref('020-7946 0958')).toBe('tel:02079460958')
  })

  it('drops a bracketed trunk prefix from an international number', () => {
    // The (0) in "+44 (0)20 …" is only dialled domestically; keeping it produces a
    // number that fails to connect.
    expect(telHref('+44 (0)20 7946 0958')).toBe('tel:+442079460958')
    expect(whatsappHref('+44 (0)7700 900123')).toBe('https://wa.me/447700900123')
  })

  it('keeps a leading zero on a domestic number', () => {
    // Without the +, that 0 is the number you actually dial.
    expect(telHref('(020) 7946 0958')).toBe('tel:02079460958')
  })

  it('builds a wa.me link with digits only', () => {
    // wa.me rejects a leading plus.
    expect(whatsappHref('+44 7700 900123')).toBe('https://wa.me/447700900123')
  })

  it('builds a mailto link', () => {
    expect(mailtoHref('ellen@example.com')).toBe('mailto:ellen@example.com')
  })
})
