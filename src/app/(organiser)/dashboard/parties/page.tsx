import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'

import { CreatePartyForm } from '@/components/organiser/create-party-form'
import { requireOrganiser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Invitation parties' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting reply',
  partial: 'Partly answered',
  complete: 'Answered',
}

const PARTIES_PER_PAGE = 50

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireOrganiser()

  const { page: pageParam } = await searchParams
  const requested = Number(pageParam)
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1

  const payload = await getPayload({ config })
  const parties = await payload.find({
    collection: 'invitation-parties',
    limit: PARTIES_PER_PAGE,
    page,
    sort: 'displayName',
    depth: 0,
    overrideAccess: true,
  })

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Invitation parties</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Invitation parties</h1>
      <p className="mt-1 text-sm text-organiser-muted">
        Group people who are invited together. Each party gets one private invitation link.
      </p>

      <CreatePartyForm className="mt-8" />

      <section className="mt-10" aria-labelledby="parties-heading">
        <h2 id="parties-heading" className="text-sm font-medium text-organiser-muted">
          {parties.totalDocs} {parties.totalDocs === 1 ? 'party' : 'parties'}
        </h2>

        {parties.totalDocs === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-organiser-border p-8 text-center text-sm text-organiser-muted">
            No invitation parties yet. Add the first one above: a household, a couple, or a single
            guest.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-organiser-border overflow-hidden rounded-lg border border-organiser-border bg-organiser-surface">
            {parties.docs.map((party) => (
              <li key={party.id}>
                <Link
                  href={`/dashboard/parties/${party.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-organiser-bg"
                >
                  <span className="font-medium">{party.displayName}</span>
                  <span className="text-sm text-organiser-muted">
                    {STATUS_LABEL[party.status] ?? party.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {(parties.totalPages ?? 1) > 1 ? (
          <nav
            aria-label="Invitation party pages"
            className="mt-4 flex items-center justify-between text-sm"
          >
            {page > 1 ? (
              <Link
                href={`/dashboard/parties?page=${page - 1}`}
                className="rounded-md border border-organiser-border px-3 py-1.5 font-medium hover:bg-organiser-surface"
              >
                Previous
              </Link>
            ) : (
              <span className="text-organiser-muted opacity-50">Previous</span>
            )}
            <span className="text-organiser-muted">
              Page {parties.page ?? 1} of {parties.totalPages}
            </span>
            {page < (parties.totalPages ?? 1) ? (
              <Link
                href={`/dashboard/parties?page=${page + 1}`}
                className="rounded-md border border-organiser-border px-3 py-1.5 font-medium hover:bg-organiser-surface"
              >
                Next
              </Link>
            ) : (
              <span className="text-organiser-muted opacity-50">Next</span>
            )}
          </nav>
        ) : null}
      </section>
    </div>
  )
}
