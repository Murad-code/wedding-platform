export type WeddingContact = {
  id: number
  name: string
  role: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  visibleToGuests: boolean
  order: number
}

/**
 * Contacts a guest may see.
 *
 * Organisers keep supplier numbers here too; those stay internal. Filtering happens
 * server-side so a hidden contact's phone number never reaches the browser.
 */
export function guestVisibleContacts(contacts: readonly WeddingContact[]): WeddingContact[] {
  return contacts
    .filter((contact) => contact.visibleToGuests)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

/** True when a contact has at least one way to reach them. */
export function hasContactMethod(contact: WeddingContact): boolean {
  return Boolean(contact.phone || contact.whatsapp || contact.email)
}

/**
 * Normalises a phone number for dialling.
 *
 * Organisers type numbers however they like — spaces, brackets, dashes. The one case
 * worth handling beyond stripping punctuation is the parenthesised trunk prefix in
 * "+44 (0)20 7946 0958": that `0` is only dialled domestically, so keeping it produces a
 * number that fails to connect from a mobile.
 *
 * This is deliberately not full E.164 parsing — that needs a country database and this
 * is a wedding, not a telecoms product. It handles the notation people actually type.
 */
function normalisePhone(phone: string): string {
  const trimmed = phone.trim()
  const isInternational = trimmed.startsWith('+')
  // Drop a bracketed trunk prefix before stripping punctuation, while the brackets
  // still mark it as optional.
  const withoutTrunk = isInternational ? trimmed.replace(/\(0\)/g, '') : trimmed
  return withoutTrunk.replace(/[^\d+]/g, '')
}

export function telHref(phone: string): string {
  return `tel:${normalisePhone(phone)}`
}

export function whatsappHref(phone: string): string {
  // wa.me takes digits only, with no leading plus.
  return `https://wa.me/${normalisePhone(phone).replace(/\D/g, '')}`
}

export function mailtoHref(email: string): string {
  return `mailto:${email}`
}
