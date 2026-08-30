import type { Metadata } from 'next'
import Link from 'next/link'

import { AddTableForm } from '@/components/organiser/add-table-form'
import { DeleteTableButton } from '@/components/organiser/delete-table-button'
import { SeatingPlanner } from '@/components/organiser/seating-planner'
import { requireOrganiser } from '@/lib/auth/session'
import { getSeatableGuests, getTables } from '@/lib/seating'

export const metadata: Metadata = { title: 'Seating' }
export const dynamic = 'force-dynamic'

export default async function SeatingPage() {
  await requireOrganiser()

  const [tables, guests] = await Promise.all([getTables(), getSeatableGuests()])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Seating</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Seating plan</h1>
      <p className="mt-1 text-sm text-organiser-muted">
        Only guests who have accepted appear here. Drag people onto a table, or use the menu on each
        name — both work the same way.
      </p>

      {/* The planner holds its own optimistic state. Keying on the table set means
          adding or deleting a table remounts it with fresh server data, rather than
          leaving guests shown at a table that no longer exists. */}
      <SeatingPlanner
        key={tables.map((table) => `${table.id}:${table.capacity}`).join('|')}
        tables={tables}
        guests={guests}
      />

      <section className="mt-10" aria-labelledby="manage-heading">
        <h2 id="manage-heading" className="text-lg font-semibold">
          Manage tables
        </h2>

        {tables.length > 0 ? (
          <ul className="mt-3 divide-y divide-organiser-border overflow-hidden rounded-lg border border-organiser-border bg-organiser-surface">
            {tables.map((table) => (
              <li key={table.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="text-sm">
                  <span className="font-medium">{table.name}</span>
                  <span className="ml-2 text-organiser-muted">
                    {table.capacity} seats · {table.shape}
                  </span>
                </span>
                <DeleteTableButton id={table.id} name={table.name} />
              </li>
            ))}
          </ul>
        ) : null}

        <AddTableForm className="mt-4" nextOrder={(tables.at(-1)?.order ?? 0) + 10} />
      </section>
    </div>
  )
}
