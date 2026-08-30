import { getSnapshot } from '@/lib/photo-queue'
import { getWeddingSettings } from '@/lib/wedding'

export const dynamic = 'force-dynamic'

/**
 * The photo queue as plain JSON.
 *
 * This is the polling fallback. Venue wifi and rural 4G both break long-lived
 * connections, and a guest whose stream cannot be re-established still needs to know
 * when their group is called — a frozen screen at a wedding is worse than a slow one.
 *
 * Public, and public only because it carries no membership: `getSnapshot` publishes the
 * running order, never who is in each photograph.
 */
export async function GET() {
  const settings = await getWeddingSettings()

  if (!settings.features.photoQueue) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
  }

  return Response.json(await getSnapshot(), { headers: NO_STORE })
}

const NO_STORE = { 'Cache-Control': 'no-store' }
