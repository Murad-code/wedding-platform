import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'

import { GuestFilterBar } from '@/components/organiser/guest-filter-bar'
import { GuestTable } from '@/components/organiser/guest-table'
import { filtersToQuery, hasActiveFilters, parseGuestFilters } from '@/domain/guests/filters'
import { requireOrganiser } from '@/lib/auth/session'
import { findGuests } from '@/lib/guest-list'

export const metadata: Metadata = { title: 'Guest list' }
export const dynamic = 'force-dynamic'

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireOrganiser()

  const filters = parseGuestFilters(await searchParams)
  const [page, payload] = await Promise.all([findGuests(filters), getPayload({ config })])

  // Party and tag options for the filter bar. Kept shallow — these are pickers, not data.
  const [parties, tags] = await Promise.all([
    payload.find({
      collection: 'invitation-parties',
      limit: 500,
      sort: 'displayName',
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({ collection: 'tags', limit: 200, sort: 'name', depth: 0, overrideAccess: true }),
  ])

  const query = filtersToQuery(filters)
  const filtered = hasActiveFilters(filters)

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Guest list</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Guest list</h1>
          <p className="mt-1 text-sm text-organiser-muted">
            {page.total} {page.total === 1 ? 'guest' : 'guests'}
            {filtered ? ' matching your filters' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/api/guests/export${query ? `?${query}` : ''}`}
            prefetch={false}
            className="rounded-md border border-organiser-border px-3 py-1.5 text-sm font-medium hover:bg-organiser-surface"
          >
            {filtered ? 'Export these guests' : 'Export CSV'}
          </Link>
          <Link
            href="/dashboard/guests/import"
            className="rounded-md border border-organiser-border px-3 py-1.5 text-sm font-medium hover:bg-organiser-surface"
          >
            Import CSV
          </Link>
          <Link
            href="/dashboard/parties"
            className="rounded-md bg-organiser-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            Add guests
          </Link>
        </div>
      </header>

      <GuestFilterBar
        filters={filters}
        parties={parties.docs.map((p) => ({ id: p.id, name: p.displayName }))}
        tags={tags.docs.map((t) => ({ id: t.id, name: t.name }))}
        className="mt-6"
      />

      <GuestTable page={page} filters={filters} filtered={filtered} className="mt-6" />
    </div>
  )
}
