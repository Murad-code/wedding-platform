import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AddPhotoGroupForm } from '@/components/organiser/add-photo-group-form'
import {
  AddMemberForm,
  DeletePhotoGroupButton,
  MovePhotoGroupButton,
  RemoveMemberButton,
} from '@/components/organiser/photo-group-controls'
import { summarise } from '@/domain/photo-queue/queue'
import { requireOrganiser } from '@/lib/auth/session'
import { getPhotoGroups, getPhotographableGuests } from '@/lib/photo-queue'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Photographs' }
export const dynamic = 'force-dynamic'

export default async function PhotoGroupsPage() {
  await requireOrganiser()

  const settings = await getWeddingSettings()
  // A disabled feature has no half-built page: the route simply does not exist.
  if (!settings.features.photoQueue) notFound()

  const [groups, guests] = await Promise.all([getPhotoGroups(), getPhotographableGuests()])
  const byId = new Map(guests.map((guest) => [guest.id, guest]))
  const summary = summarise(groups)

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Photographs</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Photographs</h1>
          <p className="mt-1 text-sm text-organiser-muted">
            The running order for the day. Guests see these names and can tell how far away their
            own photo is, so write them the way the photographer will call them out.
          </p>
        </div>

        <Link
          href="/dashboard/photos/run"
          className="rounded-md bg-organiser-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          Open the controller
        </Link>
      </header>

      <AddPhotoGroupForm className="mt-6" />

      <section className="mt-8" aria-labelledby="running-order">
        <h2 id="running-order" className="text-lg font-semibold">
          Running order
        </h2>

        {groups.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-organiser-border p-6 text-center text-sm text-organiser-muted">
            No photographs yet. Add the first one above — most couples end up with between ten and
            twenty.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-organiser-muted">
              {summary.total} {summary.total === 1 ? 'photograph' : 'photographs'}
              {summary.completed > 0 ? `, ${summary.completed} already taken` : ''}
            </p>

            <ol className="mt-3 space-y-3">
              {groups.map((group, index) => {
                const members = group.memberIds
                  .map((id) => byId.get(id))
                  .filter((guest) => guest !== undefined)

                return (
                  <li key={group.id}>
                    <article
                      data-queue-status={group.status}
                      className="rounded-lg border border-organiser-border bg-organiser-surface p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium">
                            <span className="mr-2 text-organiser-muted">{index + 1}.</span>
                            {group.name}
                          </h3>
                          <p className="mt-0.5 text-sm text-organiser-muted">
                            {members.length} {members.length === 1 ? 'person' : 'people'}
                            {group.estimatedMinutes ? ` · about ${group.estimatedMinutes} min` : ''}
                            {group.description ? ` · ${group.description}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <MovePhotoGroupButton
                            id={group.id}
                            name={group.name}
                            direction="up"
                            disabled={index === 0}
                          />
                          <MovePhotoGroupButton
                            id={group.id}
                            name={group.name}
                            direction="down"
                            disabled={index === groups.length - 1}
                          />
                          <DeletePhotoGroupButton id={group.id} name={group.name} />
                        </div>
                      </div>

                      {members.length > 0 ? (
                        <ul className="mt-3 flex flex-wrap gap-1.5">
                          {members.map((guest) => (
                            <li
                              key={guest.id}
                              className="flex items-center gap-1 rounded-full bg-organiser-bg px-2 py-0.5 text-xs"
                            >
                              {guest.displayName}
                              <RemoveMemberButton
                                groupId={group.id}
                                groupName={group.name}
                                guestId={guest.id}
                                guestName={guest.displayName}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-xs text-organiser-muted">
                          Nobody added yet. Guests can only be told their photo is coming up if they
                          are in it.
                        </p>
                      )}

                      <div className="mt-3 border-t border-organiser-border pt-3">
                        <AddMemberForm
                          groupId={group.id}
                          groupName={group.name}
                          candidates={guests.filter((guest) => !group.memberIds.includes(guest.id))}
                        />
                      </div>
                    </article>
                  </li>
                )
              })}
            </ol>
          </>
        )}

        {guests.length === 0 ? (
          <p className="mt-4 text-sm text-organiser-muted">
            Nobody has accepted yet, so there is nobody to put in a photograph.{' '}
            <Link href="/dashboard/guests" className="underline">
              Go to the guest list
            </Link>
            .
          </p>
        ) : null}
      </section>
    </div>
  )
}
