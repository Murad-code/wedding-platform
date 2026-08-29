'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { bulkUpdateGuests, type ActionState } from '@/app/(organiser)/dashboard/guests/actions'
import { filtersToQuery, withFilter, type GuestFilters } from '@/domain/guests/filters'
import type { RsvpStatus } from '@/domain/rsvp/status'
import { cn } from '@/lib/cn'
import type { GuestListPage } from '@/lib/guest-list'

const STATUS_LABEL: Record<RsvpStatus, string> = {
  pending: 'Awaiting reply',
  attending: 'Attending',
  declined: 'Declined',
}

const STATUS_CLASS: Record<RsvpStatus, string> = {
  pending: 'text-status-pending',
  attending: 'text-status-attending',
  declined: 'text-status-declined',
}

const initial: ActionState = {}

export function GuestTable({
  page,
  filters,
  filtered,
  className,
}: {
  page: GuestListPage
  filters: GuestFilters
  filtered: boolean
  className?: string
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [state, formAction, pending] = useActionState(bulkUpdateGuests, initial)

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = page.rows.length > 0 && page.rows.every((row) => selected.has(row.id))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(page.rows.map((row) => row.id)))
  }

  if (page.total === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-organiser-border p-10 text-center',
          className,
        )}
      >
        <p className="font-medium">
          {filtered ? 'No guests match those filters' : 'No guests yet'}
        </p>
        <p className="mt-1 text-sm text-organiser-muted">
          {filtered
            ? 'Try clearing a filter, or search for a different name.'
            : 'Add an invitation party first, then add the people in it.'}
        </p>
        {filtered ? null : (
          <Link
            href="/dashboard/parties"
            className="mt-4 inline-block rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white"
          >
            Add your first guests
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className={className}>
      {selected.size > 0 ? (
        <form
          action={formAction}
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-organiser-accent/40 bg-organiser-accent/5 p-3"
        >
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="guestIds" value={id} />
          ))}

          <p className="text-sm font-medium" role="status">
            {selected.size} selected
          </p>

          <div className="ml-auto flex flex-wrap gap-2">
            <BulkButton name="action" value="markAttending" disabled={pending}>
              Mark attending
            </BulkButton>
            <BulkButton name="action" value="markDeclined" disabled={pending}>
              Mark declined
            </BulkButton>
            <BulkButton name="action" value="markPending" disabled={pending}>
              Reset to awaiting
            </BulkButton>
            <BulkButton name="action" value="delete" disabled={pending} destructive>
              Delete
            </BulkButton>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-md px-3 py-1.5 text-sm text-organiser-muted underline"
            >
              Clear selection
            </button>
          </div>

          {state.error ? (
            <p role="alert" className="w-full text-sm text-status-declined">
              {state.error}
            </p>
          ) : null}
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-organiser-border bg-organiser-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Guest list, {page.total} {page.total === 1 ? 'guest' : 'guests'}
          </caption>
          <thead className="border-b border-organiser-border text-left text-organiser-muted">
            <tr>
              <th scope="col" className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all guests on this page"
                />
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Name
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Party
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                RSVP
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Dietary
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-organiser-border">
            {page.rows.map((row) => {
              const dietary = [row.allergies, row.dietaryRequirements].filter(Boolean).join(' · ')
              return (
                <tr
                  key={row.id}
                  className={selected.has(row.id) ? 'bg-organiser-accent/5' : undefined}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.displayName}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/guests/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.displayName}
                    </Link>
                    {row.isPlusOne ? (
                      <span className="ml-2 text-xs text-organiser-muted">plus one</span>
                    ) : null}
                    {row.ageGroup !== 'adult' ? (
                      <span className="ml-2 text-xs text-organiser-muted">{row.ageGroup}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-organiser-muted">{row.partyName}</td>
                  <td className="px-3 py-2">
                    {/* Status carries text as well as colour — never colour alone. */}
                    <span
                      className={STATUS_CLASS[row.rsvpStatus]}
                      data-rsvp-status={row.rsvpStatus}
                    >
                      {STATUS_LABEL[row.rsvpStatus]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-organiser-muted">
                    {dietary ? (
                      <span className="text-status-pending">{dietary}</span>
                    ) : (
                      <span aria-hidden="true">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {page.totalPages > 1 ? (
        <nav
          aria-label="Guest list pages"
          className="mt-4 flex items-center justify-between text-sm"
        >
          <PageLink filters={filters} page={page.page - 1} disabled={page.page <= 1}>
            Previous
          </PageLink>
          <span className="text-organiser-muted">
            Page {page.page} of {page.totalPages}
          </span>
          <PageLink filters={filters} page={page.page + 1} disabled={page.page >= page.totalPages}>
            Next
          </PageLink>
        </nav>
      ) : null}
    </div>
  )
}

function BulkButton({
  name,
  value,
  disabled,
  destructive,
  children,
}: {
  name: string
  value: string
  disabled: boolean
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled}
      className={cn(
        'rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-60',
        destructive
          ? 'border-status-declined/40 text-status-declined hover:bg-status-declined/10'
          : 'border-organiser-border hover:bg-organiser-surface',
      )}
    >
      {children}
    </button>
  )
}

function PageLink({
  filters,
  page,
  disabled,
  children,
}: {
  filters: GuestFilters
  page: number
  disabled: boolean
  children: React.ReactNode
}) {
  if (disabled) {
    return <span className="text-organiser-muted opacity-50">{children}</span>
  }

  const query = filtersToQuery(withFilter(filters, 'page', page))
  return (
    <Link
      href={query ? `/dashboard/guests?${query}` : '/dashboard/guests'}
      className="rounded-md border border-organiser-border px-3 py-1.5 font-medium hover:bg-organiser-surface"
    >
      {children}
    </Link>
  )
}
