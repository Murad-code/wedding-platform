import { Mail, MessageCircle, Phone } from 'lucide-react'

import {
  hasContactMethod,
  mailtoHref,
  telHref,
  whatsappHref,
  type WeddingContact,
} from '@/domain/contacts/contact'

export function ContactList({ contacts }: { contacts: readonly WeddingContact[] }) {
  return (
    <ul className="space-y-6">
      {contacts.map((contact) => (
        <li
          key={contact.id}
          className="rounded-2xl border border-guest-border bg-guest-surface p-5"
        >
          <p className="font-guest-display text-xl">{contact.name}</p>
          {contact.role ? <p className="text-sm text-guest-muted">{contact.role}</p> : null}

          {hasContactMethod(contact) ? (
            <ul className="mt-4 flex flex-wrap gap-3">
              {contact.phone ? (
                <ContactLink
                  href={telHref(contact.phone)}
                  icon={Phone}
                  label={`Call ${contact.name}`}
                >
                  {contact.phone}
                </ContactLink>
              ) : null}
              {contact.whatsapp ? (
                <ContactLink
                  href={whatsappHref(contact.whatsapp)}
                  icon={MessageCircle}
                  label={`Message ${contact.name} on WhatsApp`}
                  external
                >
                  WhatsApp
                </ContactLink>
              ) : null}
              {contact.email ? (
                <ContactLink
                  href={mailtoHref(contact.email)}
                  icon={Mail}
                  label={`Email ${contact.name}`}
                >
                  Email
                </ContactLink>
              ) : null}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function ContactLink({
  href,
  icon: Icon,
  label,
  external = false,
  children,
}: {
  href: string
  icon: typeof Phone
  label: string
  external?: boolean
  children: React.ReactNode
}) {
  return (
    <li>
      <a
        href={href}
        aria-label={label}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        // 44px minimum touch target (docs/UX.md §6).
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-guest-border px-4 text-sm hover:bg-guest-bg"
      >
        <Icon aria-hidden="true" className="size-4" />
        {children}
      </a>
    </li>
  )
}
