import type { Metadata } from 'next'
import Link from 'next/link'
import config from '@payload-config'
import { getPayload } from 'payload'

import { DispatchNowButton } from '@/components/organiser/dispatch-now-button'
import { requireOrganiser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Messages' }
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  queued: 'Waiting',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
}

/**
 * What the platform has sent, and what it could not.
 *
 * Exists because a message that silently failed is worse than one that was never
 * attempted: the couple believes their guests were told.
 */
export default async function NotificationsPage() {
  await requireOrganiser()

  const payload = await getPayload({ config })

  const [recent, failed, waiting] = await Promise.all([
    payload.find({
      collection: 'notifications',
      limit: 100,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    }),
    payload.count({
      collection: 'notifications',
      where: { status: { equals: 'failed' } },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'notifications',
      where: { status: { equals: 'queued' } },
      overrideAccess: true,
    }),
  ])

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Messages</span>
      </nav>

      <header className="mt-3">
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-organiser-muted">
          Emails and texts sent to guests. These go out automatically from what happens on the day,
          not by hand.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-organiser-muted">
          {waiting.totalDocs} waiting · {failed.totalDocs} failed
        </p>
        <DispatchNowButton />
      </div>

      {recent.docs.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-organiser-border p-6 text-center text-sm text-organiser-muted">
          Nothing has been sent yet. Messages are queued automatically when a photograph is called
          on the day.
        </p>
      ) : (
        <table className="mt-6 w-full border-collapse text-sm">
          <caption className="sr-only">Messages sent to guests, most recent first</caption>
          <thead>
            <tr className="border-b border-organiser-border text-left text-organiser-muted">
              <th scope="col" className="py-2 font-medium">
                Guest
              </th>
              <th scope="col" className="py-2 font-medium">
                Message
              </th>
              <th scope="col" className="py-2 font-medium">
                How
              </th>
              <th scope="col" className="py-2 font-medium">
                Status
              </th>
              <th scope="col" className="py-2 font-medium">
                Tries
              </th>
            </tr>
          </thead>
          <tbody>
            {recent.docs.map((notification) => {
              const guest =
                typeof notification.guest === 'object' && notification.guest !== null
                  ? [notification.guest.firstName, notification.guest.lastName]
                      .filter(Boolean)
                      .join(' ')
                  : 'Unknown guest'

              return (
                <tr
                  key={notification.id}
                  data-status={notification.status}
                  className="border-b border-organiser-border/60 align-top"
                >
                  <td className="py-2 pr-4">{guest}</td>
                  <td className="py-2 pr-4">
                    <span className="block">{notification.type}</span>
                    {notification.error ? (
                      <span className="block text-xs text-status-declined">
                        {notification.error}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4">{notification.channel === 'sms' ? 'Text' : 'Email'}</td>
                  <td className="py-2 pr-4">
                    {STATUS_LABELS[notification.status] ?? notification.status}
                  </td>
                  <td className="py-2">{notification.attempts}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
