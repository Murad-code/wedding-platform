import type { Metadata } from 'next'
import Link from 'next/link'

import { ChangePasswordForm } from '@/components/organiser/change-password-form'
import { requireOrganiser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Your account' }
export const dynamic = 'force-dynamic'

const ROLE_DESCRIPTIONS = {
  admin: 'You can change everything, including who is on the team.',
  organiser: 'You can change everything except who is on the team.',
  viewer: 'You can see everything but not change it.',
} as const

export default async function AccountPage() {
  const session = await requireOrganiser()

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Your account</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Your account</h1>

      <dl className="mt-6 space-y-3 text-sm">
        <div>
          <dt className="text-organiser-muted">Name</dt>
          <dd className="font-medium">{session.name || 'Not set'}</dd>
        </div>
        <div>
          <dt className="text-organiser-muted">Email</dt>
          <dd className="font-medium">{session.email}</dd>
        </div>
        <div>
          <dt className="text-organiser-muted">Role</dt>
          <dd>
            <span className="font-medium capitalize">{session.actor.role}</span>
            <span className="text-organiser-muted">. {ROLE_DESCRIPTIONS[session.actor.role]}</span>
          </dd>
        </div>
      </dl>

      <ChangePasswordForm className="mt-8" />
    </div>
  )
}
