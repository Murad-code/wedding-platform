import Link from 'next/link'

import type { FeatureFlags } from '@/domain/wedding/features'
import { cn } from '@/lib/cn'

type NavItem = { href: string; label: string }

/**
 * Builds the guest navigation from the enabled features.
 *
 * A section that is switched off is absent rather than empty — a wedding with no
 * accommodation to recommend should not show a page saying so (docs/UX.md §5).
 */
export function guestNavItems(features: FeatureFlags): NavItem[] {
  // The itinerary lives on the "our day" page rather than having its own entry.
  const items: NavItem[] = [
    { href: '/our-day', label: 'Our day' },
    { href: '/venue', label: 'Venue & travel' },
  ]

  if (features.faqs) items.push({ href: '/faqs', label: 'FAQs' })
  if (features.contacts) items.push({ href: '/contact', label: 'Contact' })
  if (features.rsvp) items.push({ href: '/rsvp', label: 'RSVP' })

  return items
}

export function SiteNav({ items, className }: { items: NavItem[]; className?: string }) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Wedding website" className={cn('w-full', className)}>
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-sm tracking-[0.15em] text-guest-muted uppercase transition-colors hover:text-guest-ink"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
