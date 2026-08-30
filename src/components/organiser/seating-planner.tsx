'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useMemo, useState, useTransition } from 'react'

import { moveGuest } from '@/app/(organiser)/dashboard/seating/actions'
import {
  assignGuest,
  buildPlan,
  describeMove,
  occupancyFor,
  summarise,
  unassignedGuests,
  warningsFor,
  type SeatedGuest,
  type SeatingTable,
} from '@/domain/seating/seating'
import { cn } from '@/lib/cn'

const UNASSIGNED = 'unassigned'

function droppableIdFor(tableId: number | null) {
  return tableId === null ? UNASSIGNED : `table-${tableId}`
}

function tableIdFrom(droppableId: string): number | null {
  return droppableId === UNASSIGNED ? null : Number(droppableId.replace('table-', ''))
}

export function SeatingPlanner({
  tables,
  guests: initialGuests,
}: {
  tables: SeatingTable[]
  guests: SeatedGuest[]
}) {
  const [guests, setGuests] = useState(initialGuests)
  const [announcement, setAnnouncement] = useState('')
  const [isSaving, startTransition] = useTransition()

  // A keyboard sensor alongside the pointer one, so the plan is operable without a
  // mouse. The select on each guest row is the primary keyboard path; this makes the
  // drag affordance itself reachable too (docs/UX.md §3.3).
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))

  const plan = useMemo(() => buildPlan(tables, guests), [tables, guests])
  const unassigned = useMemo(() => unassignedGuests(guests), [guests])
  const summary = useMemo(() => summarise(tables, guests), [tables, guests])
  const warnings = useMemo(() => warningsFor(tables, guests), [tables, guests])

  function move(guestId: number, tableId: number | null) {
    const guest = guests.find((candidate) => candidate.id === guestId)
    if (!guest || guest.tableId === tableId) return

    // Optimistic: the plan updates immediately, then the server confirms.
    const next = assignGuest(guests, guestId, tableId)
    setGuests(next)

    const table = tables.find((candidate) => candidate.id === tableId) ?? null
    setAnnouncement(
      describeMove(guest.displayName, table, table ? occupancyFor(table, next) : undefined),
    )

    startTransition(async () => {
      const result = await moveGuest(guestId, tableId)
      if (result.error) {
        // Put it back rather than showing a plan that does not match the database.
        setGuests(guests)
        setAnnouncement(`Could not move ${guest.displayName}. ${result.error}`)
      }
    })
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${active.data.current?.name ?? 'guest'}.`,
    onDragOver: ({ over }) =>
      over ? `Over ${over.data.current?.label ?? 'a table'}.` : 'Not over a table.',
    onDragEnd: ({ active, over }) =>
      over
        ? `${active.data.current?.name ?? 'Guest'} dropped on ${over.data.current?.label ?? 'a table'}.`
        : 'Move cancelled.',
    onDragCancel: () => 'Move cancelled.',
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    move(Number(active.id), tableIdFrom(String(over.id)))
  }

  const tableOptions = [
    { value: '', label: 'Unassigned' },
    ...tables.map((table) => ({ value: String(table.id), label: table.name })),
  ]

  return (
    <DndContext
      // A stable id keeps dnd-kit's generated aria-describedby identical on the server
      // and the client; without it every draggable logs a hydration mismatch.
      id="seating-planner"
      sensors={sensors}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements }}
    >
      {/* Announces the outcome of every move, however it was made. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Seating writes happen in the background, so say when one is in flight —
          otherwise an organiser could close the tab on an unsaved change. */}
      <p
        aria-hidden={!isSaving}
        className={cn(
          'mt-4 text-sm text-organiser-muted transition-opacity',
          isSaving ? 'opacity-100' : 'opacity-0',
        )}
        data-saving={isSaving ? 'true' : 'false'}
      >
        Saving…
      </p>

      <section aria-labelledby="summary-heading" className="mt-4">
        <h2 id="summary-heading" className="sr-only">
          Seating summary
        </h2>
        <dl className="grid gap-4 sm:grid-cols-4">
          {[
            ['Attending', summary.totalGuests],
            ['Seated', summary.seated],
            ['Still to seat', summary.unassigned],
            ['Seats available', summary.totalCapacity],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-lg border border-organiser-border bg-organiser-surface p-4"
            >
              <dt className="text-sm text-organiser-muted">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {warnings.length > 0 ? (
        <section aria-labelledby="warnings-heading" className="mt-6">
          <h2 id="warnings-heading" className="sr-only">
            Warnings
          </h2>
          <ul className="space-y-2">
            {warnings.map((warning, index) => (
              <li
                key={index}
                className="rounded-lg border border-status-pending/40 bg-status-pending/5 px-4 py-2.5 text-sm"
              >
                {warning.kind === 'not-enough-seats'
                  ? `There are ${warning.guests} guests but only ${warning.capacity} seats. You will need another table.`
                  : warning.kind === 'over-capacity'
                    ? `${warning.tableName} has ${warning.seated} guests for ${warning.capacity} seats.`
                    : `${warning.count} ${warning.count === 1 ? 'guest still needs' : 'guests still need'} a seat.`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
        <UnassignedPane guests={unassigned} tableOptions={tableOptions} onMove={move} />

        <section aria-labelledby="tables-heading">
          <h2 id="tables-heading" className="text-lg font-semibold">
            Tables
          </h2>

          {plan.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-organiser-border p-8 text-center text-sm text-organiser-muted">
              No tables yet. Add one below and start seating people.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {plan.map((occupancy) => (
                <TableCard
                  key={occupancy.table.id}
                  occupancy={occupancy}
                  tableOptions={tableOptions}
                  onMove={move}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </DndContext>
  )
}

function UnassignedPane({
  guests,
  tableOptions,
  onMove,
}: {
  guests: SeatedGuest[]
  tableOptions: { value: string; label: string }[]
  onMove: (guestId: number, tableId: number | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: UNASSIGNED,
    data: { label: 'Unassigned' },
  })

  return (
    <section aria-labelledby="unassigned-heading">
      <h2 id="unassigned-heading" className="text-lg font-semibold">
        Still to seat ({guests.length})
      </h2>
      <div
        ref={setNodeRef}
        className={cn(
          'mt-3 min-h-24 rounded-lg border p-2',
          isOver ? 'border-organiser-accent bg-organiser-accent/5' : 'border-organiser-border',
        )}
      >
        {guests.length === 0 ? (
          <p className="p-4 text-center text-sm text-organiser-muted">Everyone has a seat.</p>
        ) : (
          <ul className="space-y-2">
            {guests.map((guest) => (
              <li key={guest.id}>
                <GuestChip guest={guest} tableOptions={tableOptions} onMove={onMove} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function TableCard({
  occupancy,
  tableOptions,
  onMove,
}: {
  occupancy: ReturnType<typeof occupancyFor>
  tableOptions: { value: string; label: string }[]
  onMove: (guestId: number, tableId: number | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableIdFor(occupancy.table.id),
    data: { label: occupancy.table.name },
  })

  return (
    <article
      ref={setNodeRef}
      className={cn(
        'rounded-lg border bg-organiser-surface p-4',
        occupancy.isOverCapacity
          ? 'border-status-pending'
          : isOver
            ? 'border-organiser-accent'
            : 'border-organiser-border',
      )}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">{occupancy.table.name}</h3>
        <p
          className={cn(
            'text-sm tabular-nums',
            occupancy.isOverCapacity ? 'text-status-pending' : 'text-organiser-muted',
          )}
          data-occupancy={`${occupancy.seated}/${occupancy.capacity}`}
        >
          {occupancy.seated}/{occupancy.capacity}
          {occupancy.isOverCapacity ? <span className="ml-1">over capacity</span> : null}
        </p>
      </header>

      {occupancy.guests.length === 0 ? (
        <p className="mt-3 text-sm text-organiser-muted">Nobody seated here yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {occupancy.guests.map((guest) => (
            <li key={guest.id}>
              <GuestChip guest={guest} tableOptions={tableOptions} onMove={onMove} />
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function GuestChip({
  guest,
  tableOptions,
  onMove,
}: {
  guest: SeatedGuest
  tableOptions: { value: string; label: string }[]
  onMove: (guestId: number, tableId: number | null) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: guest.id,
    data: { name: guest.displayName },
  })

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-organiser-border bg-organiser-bg px-2 py-1.5',
        isDragging && 'opacity-50',
      )}
    >
      {/* The drag handle is a button so it is focusable and dnd-kit's keyboard sensor
          can drive it; the select below is the primary keyboard path. */}
      <button
        ref={setNodeRef}
        type="button"
        className="cursor-grab touch-none text-organiser-muted"
        aria-label={`Drag ${guest.displayName}`}
        {...listeners}
        {...attributes}
      >
        <span aria-hidden="true">⠿</span>
      </button>

      <span className="min-w-0 flex-1 truncate text-sm">
        {guest.displayName}
        {guest.partyName ? (
          <span className="ml-1 text-xs text-organiser-muted">{guest.partyName}</span>
        ) : null}
      </span>

      <label className="sr-only" htmlFor={`seat-${guest.id}`}>
        Seat {guest.displayName} at
      </label>
      <select
        id={`seat-${guest.id}`}
        value={guest.tableId === null ? '' : String(guest.tableId)}
        onChange={(event) =>
          onMove(guest.id, event.target.value === '' ? null : Number(event.target.value))
        }
        className="rounded border border-organiser-border bg-organiser-surface px-1.5 py-1 text-xs"
      >
        {tableOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
