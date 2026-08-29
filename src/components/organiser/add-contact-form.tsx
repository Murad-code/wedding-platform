'use client'

import { useActionState } from 'react'

import { addContact, type ContactState } from '@/app/(organiser)/dashboard/contacts/actions'
import { cn } from '@/lib/cn'

const initial: ContactState = {}

export function AddContactForm({
  nextOrder,
  className,
}: {
  nextOrder: number
  className?: string
}) {
  const [state, formAction, pending] = useActionState(addContact, initial)

  return (
    <form
      action={formAction}
      className={cn(
        'rounded-lg border border-organiser-border bg-organiser-surface p-4',
        className,
      )}
    >
      <h2 className="text-sm font-semibold">Add a contact</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field id="name" label="Name" required />
        <Field id="role" label="Role" placeholder="Best Man" />
        <Field id="phone" label="Phone" />
        <Field id="whatsapp" label="WhatsApp" placeholder="+44…" />
        <Field id="email" label="Email" type="email" />
        <Field id="order" label="Order" type="number" defaultValue={String(nextOrder)} />
      </div>

      {/* Explicit label rather than wrapping the input: clicking an input nested inside
          its own label can toggle twice in WebKit, so the box appears not to respond. */}
      <div className="mt-3 flex items-center gap-2 text-sm">
        <input id="visibleToGuests" type="checkbox" name="visibleToGuests" />
        <label htmlFor="visibleToGuests">Show this contact on the guest website</label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Adding…' : 'Add contact'}
      </button>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-status-declined">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

function Field({
  id,
  label,
  type = 'text',
  placeholder,
  defaultValue,
  required = false,
}: {
  id: string
  label: string
  type?: string
  placeholder?: string
  defaultValue?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm"
      />
    </div>
  )
}
