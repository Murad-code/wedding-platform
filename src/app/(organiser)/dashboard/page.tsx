import { CalendarDays, ClipboardList, Mail, Users2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { SetupChecklist } from '@/components/organiser/setup-checklist'
import { StatCard } from '@/components/organiser/stat-card'
import { daysUntilWedding } from '@/domain/wedding/settings'
import { requireOrganiser } from '@/lib/auth/session'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await requireOrganiser()
  const settings = await getWeddingSettings()

  const days = daysUntilWedding(settings)

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {settings.coupleNames ?? 'Your wedding'}
          </h1>
          <p className="mt-1 text-sm text-organiser-muted">
            Signed in as {session.name || session.email}
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="rounded-md border border-organiser-border px-3 py-1.5 text-sm font-medium hover:bg-organiser-surface"
        >
          Wedding settings
        </Link>
      </header>

      {settings.isConfigured ? null : <SetupChecklist className="mt-8" />}

      <section className="mt-8" aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="sr-only">
          Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={CalendarDays}
            label="Days until the wedding"
            value={days === null ? '—' : days >= 0 ? String(days) : 'Wedding has passed'}
            hint={settings.weddingDate ? undefined : 'Add the date in wedding settings'}
          />
          <StatCard icon={Users2} label="Guests invited" value="—" hint="Coming in Phase 2" />
          <StatCard icon={Mail} label="Awaiting RSVP" value="—" hint="Coming in Phase 3" />
          <StatCard
            icon={ClipboardList}
            label="Seating unassigned"
            value="—"
            hint="Coming in Phase 6"
          />
        </div>
      </section>
    </div>
  )
}
