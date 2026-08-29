import type { Metadata } from 'next'
import Link from 'next/link'

import { WeddingSettingsForm } from '@/components/organiser/wedding-settings-form'
import { requireOrganiser } from '@/lib/auth/session'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Wedding settings' }
export const dynamic = 'force-dynamic'

/** Converts an ISO instant to the `datetime-local` value the input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

export default async function SettingsPage() {
  await requireOrganiser()
  const settings = await getWeddingSettings()

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Wedding settings</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Wedding settings</h1>
      <p className="mt-1 text-sm text-organiser-muted">
        Everything here drives your guest website. Nothing about your wedding is written into the
        code.
      </p>

      <WeddingSettingsForm
        className="mt-8"
        settings={{
          partnerOneName: settings.partnerOneName ?? '',
          partnerTwoName: settings.partnerTwoName ?? '',
          weddingDate: toLocalInput(settings.weddingDate),
          timezone: settings.timezone,
          rsvpDeadline: toLocalInput(settings.rsvpDeadline),
          dressCode: settings.dressCode ?? '',
          welcomeMessage: settings.welcomeMessage ?? '',
          travelInformation: settings.travelInformation ?? '',
          parkingInformation: settings.parkingInformation ?? '',
          accommodationInformation: settings.accommodationInformation ?? '',
          ceremony: {
            venueName: settings.ceremony.venueName ?? '',
            address: settings.ceremony.address ?? '',
            mapUrl: settings.ceremony.mapUrl ?? '',
            startTime: toLocalInput(settings.ceremony.startTime),
            notes: settings.ceremony.notes ?? '',
          },
          reception: {
            venueName: settings.reception.venueName ?? '',
            address: settings.reception.address ?? '',
            mapUrl: settings.reception.mapUrl ?? '',
            startTime: toLocalInput(settings.reception.startTime),
            notes: settings.reception.notes ?? '',
          },
          features: settings.features,
        }}
      />
    </div>
  )
}
