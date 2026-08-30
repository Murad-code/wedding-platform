import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PhotoQueueScreen } from '@/components/guest/photo-queue-screen'
import { getSnapshot } from '@/lib/photo-queue'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Photographs' }
export const dynamic = 'force-dynamic'

/**
 * The public photo queue.
 *
 * Shows what is being photographed and what is next, which is all a guest who has
 * mislaid their invitation link needs to follow along. The personal section requires the
 * token, because knowing which photographs *you* are in means knowing who is in them.
 */
export default async function PhotosPage() {
  const settings = await getWeddingSettings()
  if (!settings.isConfigured || !settings.features.photoQueue) notFound()

  return (
    <PhotoQueueScreen
      initial={await getSnapshot()}
      myGroupIds={[]}
      coupleNames={settings.coupleNames}
      hasInvitation={false}
    />
  )
}
