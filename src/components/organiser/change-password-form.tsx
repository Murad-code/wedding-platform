'use client'

import { useActionState } from 'react'

import { changeOwnPassword, type AccountState } from '@/app/(organiser)/dashboard/account/actions'
import { MIN_PASSWORD_LENGTH } from '@/domain/auth/team'
import { cn } from '@/lib/cn'

const initial: AccountState = {}

const input = 'w-full rounded-md border border-organiser-border bg-organiser-bg px-3 py-2 text-sm'

function PasswordField({
  id,
  label,
  autoComplete,
}: {
  id: string
  label: string
  autoComplete: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="password"
        required
        autoComplete={autoComplete}
        className={input}
      />
    </div>
  )
}

export function ChangePasswordForm({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState(changeOwnPassword, initial)

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-lg border border-organiser-border bg-organiser-surface p-4',
        className,
      )}
    >
      <h2 className="text-sm font-semibold">Change your password</h2>

      <PasswordField
        id="currentPassword"
        label="Current password"
        autoComplete="current-password"
      />
      <PasswordField id="newPassword" label="New password" autoComplete="new-password" />
      <PasswordField id="confirmPassword" label="New password again" autoComplete="new-password" />

      <p className="text-xs text-organiser-muted">
        At least {MIN_PASSWORD_LENGTH} characters. You will be signed out everywhere, including
        here, and asked to sign in with the new one.
      </p>

      {state.error ? (
        <p role="alert" className="text-sm text-status-declined">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-organiser-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Changing…' : 'Change password'}
      </button>
    </form>
  )
}
