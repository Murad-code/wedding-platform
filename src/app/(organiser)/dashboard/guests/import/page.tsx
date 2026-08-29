import type { Metadata } from 'next'
import Link from 'next/link'

import { GuestImport } from '@/components/organiser/guest-import'
import { CSV_COLUMNS } from '@/domain/guests/csv'
import { requireOrganiser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Import guests' }
export const dynamic = 'force-dynamic'

export default async function ImportGuestsPage() {
  await requireOrganiser()

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard/guests" className="hover:underline">
          Guest list
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Import</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Import guests from a spreadsheet
      </h1>
      <p className="mt-2 text-sm text-organiser-muted">
        Export your spreadsheet as CSV. We’ll show you what will happen before anything is saved,
        and re-importing a corrected file is safe — guests already on the list are skipped rather
        than duplicated.
      </p>

      <section className="mt-6 rounded-lg border border-organiser-border bg-organiser-surface p-4">
        <h2 className="text-sm font-semibold">Columns</h2>
        <p className="mt-1 text-sm text-organiser-muted">
          Only <code className="font-mono">party</code> and{' '}
          <code className="font-mono">firstName</code> are required. Everything else is optional,
          and the order does not matter.
        </p>
        <p className="mt-2 font-mono text-xs break-words text-organiser-muted">
          {CSV_COLUMNS.join(', ')}
        </p>
      </section>

      <GuestImport className="mt-6" />
    </div>
  )
}
