import { CalendarDays, Mail, TriangleAlert, Users2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { SetupChecklist } from '@/components/organiser/setup-checklist'
import { StatCard } from '@/components/organiser/stat-card'
import { daysUntilWedding } from '@/domain/wedding/settings'
import { requireOrganiser } from '@/lib/auth/session'
import { getDashboardTotals } from '@/lib/guests'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await requireOrganiser()
  const [settings, totals] = await Promise.all([getWeddingSettings(), getDashboardTotals()])

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
        <nav aria-label="Dashboard sections" className="flex flex-wrap gap-2">
          {[
            { href: '/dashboard/guests', label: 'Guest list' },
            { href: '/dashboard/menu', label: 'Menu' },
            { href: '/dashboard/itinerary', label: 'Itinerary' },
            { href: '/dashboard/contacts', label: 'Contacts' },
            { href: '/dashboard/settings', label: 'Wedding settings' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-organiser-border px-3 py-1.5 text-sm font-medium hover:bg-organiser-surface"
            >
              {item.label}
            </Link>
          ))}
        </nav>
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
          <StatCard
            icon={Users2}
            label="Guests invited"
            value={String(totals.invited)}
            hint={`across ${totals.parties} ${totals.parties === 1 ? 'party' : 'parties'}`}
          />
          <StatCard
            icon={Mail}
            label="Awaiting RSVP"
            value={String(totals.pending)}
            hint={`${totals.attending} attending · ${totals.declined} declined`}
          />
          <StatCard
            icon={TriangleAlert}
            label="Dietary alerts"
            value={String(totals.dietaryAlerts)}
            hint={totals.dietaryAlerts > 0 ? 'Review before the caterer deadline' : undefined}
          />
        </div>
      </section>
    </div>
  )
}
