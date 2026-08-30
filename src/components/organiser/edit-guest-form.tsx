'use client'

import { useActionState } from 'react'

import { updateGuest, type ActionState } from '@/app/(organiser)/dashboard/guests/actions'
import { AGE_GROUPS } from '@/domain/guests/guest'
import { RSVP_STATUSES } from '@/domain/rsvp/status'
import { cn } from '@/lib/cn'

export type EditableGuest = {
  id: number
  firstName: string
  lastName: string
  ageGroup: string
  rsvpStatus: string
  isPlusOne: boolean
  email: string
  phone: string
  smsConsent: boolean
  dietaryRequirements: string
  allergies: string
  accessibilityNeeds: string
  internalNotes: string
}

const initial: ActionState = {}

export function EditGuestForm({ guest, className }: { guest: EditableGuest; className?: string }) {
  const [state, formAction, pending] = useActionState(updateGuest, initial)

  return (
    <form action={formAction} className={cn('space-y-6', className)}>
      <input type="hidden" name="guestId" value={guest.id} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-status-declined/40 bg-status-declined/5 px-3 py-2 text-sm text-status-declined"
        >
          {state.error}
        </p>
      ) : null}

      {state.ok ? (
        <p
          role="status"
          className="rounded-md border border-status-attending/40 bg-status-attending/5 px-3 py-2 text-sm text-status-attending"
        >
          Saved.
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-organiser-muted">Details</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="firstName" label="First name" defaultValue={guest.firstName} required />
          <Field id="lastName" label="Last name" defaultValue={guest.lastName} />
          <Select
            id="ageGroup"
            label="Age group"
            defaultValue={guest.ageGroup}
            options={AGE_GROUPS.map((group) => ({ value: group, label: capitalise(group) }))}
          />
          <Select
            id="rsvpStatus"
            label="RSVP"
            defaultValue={guest.rsvpStatus}
            options={RSVP_STATUSES.map((status) => ({
              value: status,
              label: status === 'pending' ? 'Awaiting reply' : capitalise(status),
            }))}
          />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <input id="isPlusOne" type="checkbox" name="isPlusOne" defaultChecked={guest.isPlusOne} />
          <label htmlFor="isPlusOne">This is a plus one</label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-organiser-muted">Contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="email" label="Email" type="email" defaultValue={guest.email} />
          <Field id="phone" label="Phone" defaultValue={guest.phone} />
        </div>

        <div className="flex items-start gap-2 text-sm">
          <input
            id="smsConsent"
            type="checkbox"
            name="smsConsent"
            defaultChecked={guest.smsConsent}
            aria-describedby="smsConsent-help"
            className="mt-1"
          />
          <div>
            {/* The caveat is a description rather than part of the label, so a screen
                reader announces a short name and then the explanation. */}
            <label htmlFor="smsConsent">This guest has agreed to receive text messages</label>
            <p id="smsConsent-help" className="text-xs text-organiser-muted">
              Only tick this if they actually said yes. A phone number on its own is not permission,
              and the date you tick it is recorded.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-organiser-muted">Catering and access</legend>
        <Field
          id="dietaryRequirements"
          label="Dietary requirements"
          defaultValue={guest.dietaryRequirements}
          multiline
        />
        <Field id="allergies" label="Allergies" defaultValue={guest.allergies} multiline />
        <Field
          id="accessibilityNeeds"
          label="Accessibility needs"
          defaultValue={guest.accessibilityNeeds}
          multiline
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-organiser-muted">Internal</legend>
        <Field
          id="internalNotes"
          label="Notes (never shown to guests)"
          defaultValue={guest.internalNotes}
          multiline
        />
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function Field({
  id,
  label,
  defaultValue,
  type = 'text',
  multiline = false,
  required = false,
}: {
  id: string
  label: string
  defaultValue: string
  type?: string
  multiline?: boolean
  required?: boolean
}) {
  const className =
    'w-full rounded-md border border-organiser-border bg-organiser-surface px-3 py-2 text-sm'

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} name={id} rows={2} defaultValue={defaultValue} className={className} />
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          required={required}
          defaultValue={defaultValue}
          className={className}
        />
      )}
    </div>
  )
}

function Select({
  id,
  label,
  defaultValue,
  options,
}: {
  id: string
  label: string
  defaultValue: string
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-organiser-border bg-organiser-surface px-3 py-2 text-sm"
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
