import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'

import {
  AddTeamMemberForm,
  ChangeRoleForm,
  RemoveTeamMemberButton,
  SetPasswordForm,
} from '@/components/organiser/team-controls'
import { isRole } from '@/domain/auth/roles'
import { requireAdmin } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Team' }
export const dynamic = 'force-dynamic'

const ROLE_SUMMARY = [
  { role: 'Admin', can: 'Everything, including managing this team.' },
  { role: 'Organiser', can: 'Everything except managing the team. The couple’s role.' },
  { role: 'Viewer', can: 'Sees everything, changes nothing.' },
]

export default async function TeamPage() {
  const session = await requireAdmin()

  const payload = await getPayload({ config })
  const users = await payload.find({
    collection: 'users',
    limit: 1000,
    sort: 'name',
    depth: 0,
    overrideAccess: true,
  })

  const members = users.docs.flatMap((user) =>
    isRole(user.role) ? [{ id: user.id, name: user.name, email: user.email, role: user.role }] : [],
  )

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Team</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Team</h1>
      <p className="mt-1 text-sm text-organiser-muted">
        Everyone who can sign in to this dashboard. Guests never need an account.
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {ROLE_SUMMARY.map((item) => (
          <div
            key={item.role}
            className="rounded-lg border border-organiser-border bg-organiser-surface p-3"
          >
            <dt className="text-sm font-semibold">{item.role}</dt>
            <dd className="mt-1 text-sm text-organiser-muted">{item.can}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-lg font-semibold">
          {members.length} {members.length === 1 ? 'person' : 'people'}
        </h2>

        <ul className="mt-3 divide-y divide-organiser-border overflow-hidden rounded-lg border border-organiser-border bg-organiser-surface">
          {members.map((member) => {
            const isYou = String(member.id) === String(session.actor.id)

            return (
              <li key={member.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium">
                      {member.name}
                      {isYou ? (
                        <span className="ml-2 text-xs font-normal text-organiser-muted">(you)</span>
                      ) : null}
                    </p>
                    <p className="text-organiser-muted">{member.email}</p>
                  </div>

                  {isYou ? (
                    <p className="text-sm text-organiser-muted">
                      Admin ·{' '}
                      <Link href="/dashboard/account" className="underline">
                        Your account
                      </Link>
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <ChangeRoleForm id={member.id} name={member.name} role={member.role} />
                      <RemoveTeamMemberButton id={member.id} name={member.name} />
                    </div>
                  )}
                </div>

                {isYou ? null : <SetPasswordForm id={member.id} name={member.name} />}
              </li>
            )
          })}
        </ul>
      </section>

      <AddTeamMemberForm className="mt-8" />
    </div>
  )
}
