import config from '@payload-config'
import { getPayload } from 'payload'

import { type AuditEventInput, hashIp, sanitiseMetadata } from '@/domain/audit/record'

/**
 * The domain models an actor id as `string | number` so it is not tied to one database.
 * The Postgres adapter issues numeric ids, so coerce here rather than widening the
 * domain to match the storage engine.
 */
function toUserId(id: number | string | null | undefined): number | undefined {
  if (id === null || id === undefined) return undefined
  const numeric = typeof id === 'number' ? id : Number(id)
  return Number.isFinite(numeric) ? numeric : undefined
}

/**
 * Appends an audit event.
 *
 * Never throws into the caller: failing to write the log must not fail the user's
 * action. A dropped audit line is logged for operators instead.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const payload = await getPayload({ config })

    await payload.create({
      collection: 'audit-events',
      // The collection denies writes to everyone so the log cannot be edited; this
      // server-side path is the only writer.
      overrideAccess: true,
      data: {
        action: input.action,
        actorType: input.actorType,
        actorUser: toUserId(input.actorUserId),
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: sanitiseMetadata(input.metadata),
        ipHash: hashIp(input.ip, process.env.PAYLOAD_SECRET ?? ''),
      },
    })
  } catch (error) {
    console.error('Failed to record audit event', {
      action: input.action,
      message: error instanceof Error ? error.message : 'unknown error',
    })
  }
}
