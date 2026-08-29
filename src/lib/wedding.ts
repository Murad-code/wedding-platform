import config from '@payload-config'
import { getPayload } from 'payload'

import { toWeddingSettingsView, type WeddingSettingsView } from '@/domain/wedding/settings'

/**
 * The single read path for wedding configuration (ADR-001).
 *
 * Every consumer calls this rather than importing the Payload global, which is what
 * would let a future multi-wedding version become `getWeddingSettings(weddingId)`
 * without touching call sites.
 */
export async function getWeddingSettings(): Promise<WeddingSettingsView> {
  const payload = await getPayload({ config })

  const raw = await payload.findGlobal({
    slug: 'wedding-settings',
    depth: 1,
    // Guest pages call this; the global's own access control governs visibility.
    overrideAccess: true,
  })

  return toWeddingSettingsView(raw)
}
