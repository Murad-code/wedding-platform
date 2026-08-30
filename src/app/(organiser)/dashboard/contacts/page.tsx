import type { Metadata } from 'next'
import Link from 'next/link'

import { AddContactForm } from '@/components/organiser/add-contact-form'
import { ContactRowActions } from '@/components/organiser/contact-row-actions'
import { requireOrganiser } from '@/lib/auth/session'
import { getContacts } from '@/lib/wedding-content'

export const metadata: Metadata = { title: 'Wedding contacts' }
export const dynamic = 'force-dynamic'

export default async function ContactsPage() {
  await requireOrganiser()
  const contacts = await getContacts()

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-organiser-muted">
        <Link href="/dashboard" className="hover:underline">
          Dashboard
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Contacts</span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Wedding contacts</h1>
      <p className="mt-1 text-sm text-organiser-muted">
        You can keep supplier numbers here too. Only contacts you mark as visible appear on the
        guest website.
      </p>

      <section className="mt-8" aria-labelledby="contacts-heading">
        <h2 id="contacts-heading" className="sr-only">
          Contacts
        </h2>

        {contacts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-organiser-border p-8 text-center text-sm text-organiser-muted">
            No contacts yet. Add whoever guests should call if they are lost on the day.
          </p>
        ) : (
          <ul className="divide-y divide-organiser-border overflow-hidden rounded-lg border border-organiser-border bg-organiser-surface">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-organiser-muted">
                    {[contact.role, contact.phone, contact.email].filter(Boolean).join(' · ') ||
                      'No contact details'}
                  </p>
                </div>
                <span
                  className={
                    contact.visibleToGuests
                      ? 'text-xs text-status-attending'
                      : 'text-xs text-organiser-muted'
                  }
                >
                  {contact.visibleToGuests ? 'Shown to guests' : 'Internal'}
                </span>
                <ContactRowActions
                  id={contact.id}
                  name={contact.name}
                  visible={contact.visibleToGuests}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddContactForm className="mt-6" nextOrder={(contacts.at(-1)?.order ?? 0) + 10} />
    </div>
  )
}
