import { createHash } from 'node:crypto'

export type ActorType = 'user' | 'guest' | 'system'

export type AuditEventInput = {
  action: string
  actorType: ActorType
  actorUserId?: number | string | null
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  ip?: string | null
}

/**
 * Salted hash of a client IP.
 *
 * Storing raw addresses would make the audit log itself a PII liability, and we only
 * ever need to answer "was this the same origin?", not "which address was it".
 * The salt is the deployment secret, so hashes are not comparable across weddings.
 */
export function hashIp(ip: string | null | undefined, salt: string): string | null {
  if (!ip) return null
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

/** Keys that must never reach the audit log, whatever a caller passes. */
const FORBIDDEN_METADATA_KEYS = new Set([
  'token',
  'tokenhash',
  'invitationtoken',
  'password',
  'secret',
  'email',
  'phone',
  'dietaryrequirements',
  'allergies',
  'accessibilityneeds',
])

/**
 * Strips sensitive keys from audit metadata.
 *
 * The audit log is widely readable by organisers and is retained after guest data is
 * purged, so it is the wrong place for tokens or special-category data. Filtering here
 * rather than trusting every call site means one forgetful caller cannot leak.
 */
export function sanitiseMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined

  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) continue
    safe[key] = value
  }
  return safe
}
