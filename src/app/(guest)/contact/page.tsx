import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContactList } from '@/components/guest/contact-list'
import { PageShell } from '@/components/guest/page-shell'
import { getGuestContacts } from '@/lib/wedding-content'
import { getWeddingSettings } from '@/lib/wedding'

export const metadata: Metadata = { title: 'Contact' }
export const dynamic = 'force-dynamic'

export default async function ContactPage() {
  const settings = await getWeddingSettings()
  if (!settings.isConfigured || !settings.features.contacts) notFound()

  // Already filtered server-side; a hidden contact's number never reaches the browser.
  const contacts = await getGuestContacts()
  if (contacts.length === 0) notFound()

  return (
    <PageShell
      settings={settings}
      title="Get in touch"
      intro="If you need anything on the day, these are the people to ask."
    >
      <ContactList contacts={contacts} />
    </PageShell>
  )
}
