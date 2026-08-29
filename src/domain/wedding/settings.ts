import { type FeatureFlags, resolveFeatures } from './features'

/**
 * The wedding configuration, as the rest of the application sees it.
 *
 * This shape is deliberately independent of Payload's generated types so that changing
 * how settings are stored does not ripple through every consumer.
 */
export type Venue = {
  venueName: string | null
  address: string | null
  mapUrl: string | null
  startTime: string | null
  notes: string | null
}

export type Faq = {
  question: string
  answer: string
}

export type WeddingSettingsView = {
  /** True once an organiser has entered the couple's names and the date. */
  isConfigured: boolean
  partnerOneName: string | null
  partnerTwoName: string | null
  /** "Sarah & Adam", or null before configuration. */
  coupleNames: string | null
  weddingDate: string | null
  timezone: string
  rsvpDeadline: string | null
  dressCode: string | null
  welcomeMessage: string | null
  heroImageUrl: string | null
  ceremony: Venue
  reception: Venue
  travelInformation: string | null
  parkingInformation: string | null
  accommodationInformation: string | null
  faqs: Faq[]
  features: FeatureFlags
}

const EMPTY_VENUE: Venue = {
  venueName: null,
  address: null,
  mapUrl: null,
  startTime: null,
  notes: null,
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function venue(value: unknown): Venue {
  if (!value || typeof value !== 'object') return { ...EMPTY_VENUE }
  const v = value as Record<string, unknown>
  return {
    venueName: text(v.venueName),
    address: text(v.address),
    mapUrl: text(v.mapUrl),
    startTime: text(v.startTime),
    notes: text(v.notes),
  }
}

function faqs(value: unknown): Faq[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const e = entry as Record<string, unknown>
    const question = text(e.question)
    const answer = text(e.answer)
    return question && answer ? [{ question, answer }] : []
  })
}

function heroImageUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  return text((value as Record<string, unknown>).url)
}

/**
 * Normalises the stored global into the view the application uses.
 *
 * Kept pure and separate from data fetching so it can be unit-tested against partial,
 * empty, and malformed records — a brand-new deployment has none of these fields set.
 */
export function toWeddingSettingsView(raw: unknown): WeddingSettingsView {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const partnerOneName = text(record.partnerOneName)
  const partnerTwoName = text(record.partnerTwoName)
  const weddingDate = text(record.weddingDate)

  const coupleNames =
    partnerOneName && partnerTwoName ? `${partnerOneName} & ${partnerTwoName}` : null

  return {
    isConfigured: Boolean(coupleNames && weddingDate),
    partnerOneName,
    partnerTwoName,
    coupleNames,
    weddingDate,
    timezone: text(record.timezone) ?? 'Europe/London',
    rsvpDeadline: text(record.rsvpDeadline),
    dressCode: text(record.dressCode),
    welcomeMessage: text(record.welcomeMessage),
    heroImageUrl: heroImageUrl(record.heroImage),
    ceremony: venue(record.ceremony),
    reception: venue(record.reception),
    travelInformation: text(record.travelInformation),
    parkingInformation: text(record.parkingInformation),
    accommodationInformation: text(record.accommodationInformation),
    faqs: faqs(record.faqs),
    features: resolveFeatures(record.enabledFeatures),
  }
}

/** Has the RSVP deadline passed? Evaluated server-side; never trust the client. */
export function isRsvpOpen(settings: WeddingSettingsView, now: Date = new Date()): boolean {
  if (!settings.features.rsvp) return false
  if (!settings.rsvpDeadline) return true
  return now.getTime() <= new Date(settings.rsvpDeadline).getTime()
}

/** Whole days until the wedding. Negative once it has passed. */
export function daysUntilWedding(
  settings: WeddingSettingsView,
  now: Date = new Date(),
): number | null {
  if (!settings.weddingDate) return null
  const MS_PER_DAY = 86_400_000
  const wedding = new Date(settings.weddingDate)
  // Compare calendar days, so "tomorrow" does not read as 0 because of clock time.
  const startOfWedding = Date.UTC(
    wedding.getUTCFullYear(),
    wedding.getUTCMonth(),
    wedding.getUTCDate(),
  )
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((startOfWedding - startOfToday) / MS_PER_DAY)
}
