'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import {
  confirmGuestImport,
  previewGuestImport,
  type ImportState,
} from '@/app/(organiser)/dashboard/guests/actions'
import { cn } from '@/lib/cn'
import type { CsvRowError } from '@/domain/guests/csv'

const initial: ImportState = {}

/**
 * Two-step import: validate and preview, then confirm.
 *
 * Nothing is written until the organiser has seen what would happen — an import that
 * silently creates 200 wrong records is far worse than one that asks first.
 */
export function GuestImport({ className }: { className?: string }) {
  const [preview, previewAction, previewing] = useActionState(previewGuestImport, initial)
  const [result, confirmAction, confirming] = useActionState(confirmGuestImport, initial)

  if (result.outcome) {
    const { partiesCreated, guestsCreated, guestsSkipped } = result.outcome
    return (
      <div
        className={cn(
          'rounded-lg border border-status-attending/40 bg-status-attending/5 p-6',
          className,
        )}
      >
        <h2 className="font-semibold" role="status">
          Import complete
        </h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            {guestsCreated} {guestsCreated === 1 ? 'guest' : 'guests'} added
          </li>
          <li>
            {partiesCreated} invitation {partiesCreated === 1 ? 'party' : 'parties'} created
          </li>
          {guestsSkipped > 0 ? <li>{guestsSkipped} already on the list, so skipped</li> : null}
        </ul>
        <Link
          href="/dashboard/guests"
          className="mt-4 inline-block rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white"
        >
          View guest list
        </Link>
      </div>
    )
  }

  return (
    <div className={className}>
      <form
        action={previewAction}
        className="rounded-lg border border-organiser-border bg-organiser-surface p-4"
      >
        <div className="space-y-1.5">
          <label htmlFor="file" className="block text-sm font-medium">
            CSV file
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="w-full text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={previewing}
          className="mt-4 rounded-md border border-organiser-border px-4 py-2 text-sm font-medium hover:bg-organiser-bg disabled:opacity-60"
        >
          {previewing ? 'Checking…' : 'Check file'}
        </button>

        {preview.error ? (
          <p role="alert" className="mt-3 text-sm text-status-declined">
            {preview.error}
          </p>
        ) : null}
      </form>

      <RowIssues title="Rows that will be skipped" issues={preview.errors} tone="declined" />
      <RowIssues title="Duplicates in the file" issues={preview.duplicates} tone="pending" />

      {preview.preview && preview.preview.length > 0 ? (
        <form
          action={confirmAction}
          className="mt-4 rounded-lg border border-organiser-border bg-organiser-surface p-4"
        >
          <input type="hidden" name="csv" value={preview.csv ?? ''} />

          <h2 className="text-sm font-semibold">
            Ready to import. First {preview.preview.length} shown
          </h2>

          <ul className="mt-3 divide-y divide-organiser-border text-sm">
            {preview.preview.map((row, index) => (
              <li key={`${row.party}-${row.name}-${index}`} className="flex justify-between py-1.5">
                <span>{row.name}</span>
                <span className="text-organiser-muted">
                  {row.party}
                  {row.ageGroup !== 'adult' ? ` · ${row.ageGroup}` : ''}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="submit"
            disabled={confirming}
            className="mt-4 rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {confirming ? 'Importing…' : 'Import these guests'}
          </button>

          {result.error ? (
            <p role="alert" className="mt-3 text-sm text-status-declined">
              {result.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  )
}

function RowIssues({
  title,
  issues,
  tone,
}: {
  title: string
  issues: CsvRowError[] | undefined
  tone: 'declined' | 'pending'
}) {
  if (!issues || issues.length === 0) return null

  return (
    <section
      className={cn(
        'mt-4 rounded-lg border p-4',
        tone === 'declined'
          ? 'border-status-declined/40 bg-status-declined/5'
          : 'border-status-pending/40 bg-status-pending/5',
      )}
    >
      <h2 className="text-sm font-semibold">
        {title} ({issues.length})
      </h2>
      <ul className="mt-2 space-y-1 text-sm">
        {issues.slice(0, 20).map((issue) => (
          <li key={`${issue.line}-${issue.message}`}>
            <span className="font-mono text-xs">Line {issue.line}</span>: {issue.message}
          </li>
        ))}
      </ul>
      {issues.length > 20 ? (
        <p className="mt-2 text-xs text-organiser-muted">and {issues.length - 20} more</p>
      ) : null}
    </section>
  )
}
