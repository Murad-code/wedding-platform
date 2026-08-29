'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  filtersToQuery,
  hasActiveFilters,
  withFilter,
  type GuestFilters,
} from '@/domain/guests/filters'
import { AGE_GROUPS } from '@/domain/guests/guest'
import { RSVP_STATUSES } from '@/domain/rsvp/status'
import { cn } from '@/lib/cn'

type Option = { id: number; name: string }

/**
 * Filter controls for the guest list.
 *
 * All state lives in the URL rather than component state, so a filtered view survives a
 * refresh and can be shared with a partner (docs/UX.md §3.2).
 */
export function GuestFilterBar({
  filters,
  parties,
  tags,
  className,
}: {
  filters: GuestFilters
  parties: Option[]
  tags: Option[]
  className?: string
}) {
  const router = useRouter()

  function apply(next: GuestFilters) {
    const query = filtersToQuery(next)
    router.push(query ? `/dashboard/guests?${query}` : '/dashboard/guests')
  }

  const active = hasActiveFilters(filters)

  return (
    <div
      className={cn(
        'rounded-lg border border-organiser-border bg-organiser-surface p-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-end gap-3">
        {/* Keyed on the URL value so navigating back, or clearing filters, resets the
            box without syncing state inside an effect. */}
        <SearchBox
          key={filters.search ?? ''}
          initial={filters.search ?? ''}
          onSearch={(value) => apply(withFilter(filters, 'search', value || null))}
        />

        <Select
          id="filter-status"
          label="RSVP"
          value={filters.rsvpStatus ?? ''}
          onChange={(value) =>
            apply(withFilter(filters, 'rsvpStatus', (value || null) as GuestFilters['rsvpStatus']))
          }
          options={[
            { value: '', label: 'Anyone' },
            ...RSVP_STATUSES.map((status) => ({
              value: status,
              label: status === 'pending' ? 'Awaiting reply' : capitalise(status),
            })),
          ]}
        />

        <Select
          id="filter-age"
          label="Age"
          value={filters.ageGroup ?? ''}
          onChange={(value) =>
            apply(withFilter(filters, 'ageGroup', (value || null) as GuestFilters['ageGroup']))
          }
          options={[
            { value: '', label: 'All' },
            ...AGE_GROUPS.map((group) => ({ value: group, label: capitalise(group) })),
          ]}
        />

        <Select
          id="filter-party"
          label="Party"
          value={filters.partyId ? String(filters.partyId) : ''}
          onChange={(value) => apply(withFilter(filters, 'partyId', value ? Number(value) : null))}
          options={[
            { value: '', label: 'All parties' },
            ...parties.map((party) => ({ value: String(party.id), label: party.name })),
          ]}
        />

        {tags.length > 0 ? (
          <Select
            id="filter-tag"
            label="Tag"
            value={filters.tagId ? String(filters.tagId) : ''}
            onChange={(value) => apply(withFilter(filters, 'tagId', value ? Number(value) : null))}
            options={[
              { value: '', label: 'All tags' },
              ...tags.map((tag) => ({ value: String(tag.id), label: tag.name })),
            ]}
          />
        ) : null}

        <Select
          id="filter-sort"
          label="Sort by"
          value={filters.sort}
          onChange={(value) => apply(withFilter(filters, 'sort', value as GuestFilters['sort']))}
          options={[
            { value: 'name', label: 'Name' },
            { value: 'party', label: 'Party' },
            { value: 'status', label: 'RSVP' },
            { value: 'recent', label: 'Recently added' },
          ]}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterChip
          label="Dietary needs"
          active={filters.special === 'dietary'}
          onClick={() =>
            apply(withFilter(filters, 'special', filters.special === 'dietary' ? null : 'dietary'))
          }
        />
        <FilterChip
          label="Plus ones"
          active={filters.special === 'plusOne'}
          onClick={() =>
            apply(withFilter(filters, 'special', filters.special === 'plusOne' ? null : 'plusOne'))
          }
        />

        {active ? (
          <button
            type="button"
            onClick={() => router.push('/dashboard/guests')}
            className="ml-auto text-sm text-organiser-muted underline hover:text-organiser-ink"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Debounced search input.
 *
 * Holds its own draft state so typing does not navigate per keystroke, and is remounted
 * by its `key` when the URL changes. The equality guard means the debounce that runs on
 * mount never fires a redundant navigation.
 */
function SearchBox({ initial, onSearch }: { initial: string; onSearch: (value: string) => void }) {
  const [value, setValue] = useState(initial)

  useEffect(() => {
    if (value.trim() === initial) return

    const timer = setTimeout(() => onSearch(value.trim()), 300)
    return () => clearTimeout(timer)
  }, [value, initial, onSearch])

  return (
    <div className="min-w-56 flex-1 space-y-1.5">
      <label htmlFor="guest-search" className="block text-sm font-medium">
        Search
      </label>
      <input
        id="guest-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Name or email"
        className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
      />
    </div>
  )
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="min-w-36 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-sm',
        active
          ? 'border-organiser-accent bg-organiser-accent/10 text-organiser-accent'
          : 'border-organiser-border text-organiser-muted hover:border-organiser-ink/30',
      )}
    >
      {label}
    </button>
  )
}
