/**
 * Feature flags let one client wedding differ from another without forking code
 * (ADR-001). Kept deliberately flat and small — a richer system can come later if a
 * real requirement demands it.
 */

export const FEATURES = [
  'rsvp',
  'menu',
  'seating',
  'itinerary',
  'photoQueue',
  'accommodation',
  'travel',
  'faqs',
  'contacts',
  'smsNotifications',
] as const

export type Feature = (typeof FEATURES)[number]

export type FeatureFlags = Record<Feature, boolean>

/**
 * A brand-new wedding should be immediately useful, so the core planning features are
 * on. SMS costs money and needs consent (docs/SECURITY.md §7), so it is opt-in.
 */
export const DEFAULT_FEATURES: FeatureFlags = {
  rsvp: true,
  menu: true,
  seating: true,
  itinerary: true,
  photoQueue: true,
  accommodation: true,
  travel: true,
  faqs: true,
  contacts: true,
  smsNotifications: false,
}

export function isFeature(value: unknown): value is Feature {
  return typeof value === 'string' && (FEATURES as readonly string[]).includes(value)
}

/** Normalises partial or unknown stored values into a complete, safe flag set. */
export function resolveFeatures(stored: unknown): FeatureFlags {
  const enabled = new Set(Array.isArray(stored) ? stored.filter(isFeature) : [])

  if (!Array.isArray(stored)) return { ...DEFAULT_FEATURES }

  return FEATURES.reduce<FeatureFlags>((acc, feature) => {
    acc[feature] = enabled.has(feature)
    return acc
  }, {} as FeatureFlags)
}

export function isFeatureEnabled(features: FeatureFlags, feature: Feature): boolean {
  return features[feature]
}
