import Link from 'next/link'
import type { ReactNode } from 'react'

import { guestNavItems, SiteNav } from './site-nav'
import type { WeddingSettingsView } from '@/domain/wedding/settings'

/**
 * Shared chrome for the guest site's inner pages.
 *
 * The landing page deliberately does not use this — it is a full-bleed hero and should
 * not carry a page heading or breadcrumb-style header.
 */
export function PageShell({
  settings,
  title,
  intro,
  children,
}: {
  settings: WeddingSettingsView
  title: string
  intro?: string | null
  children: ReactNode
}) {
  const nav = guestNavItems(settings.features)

  return (
    <div className="min-h-dvh">
      <header className="border-b border-guest-border px-6 py-6">
        <Link
          href="/"
          className="block text-center font-guest-display text-lg tracking-wide hover:opacity-80"
        >
          {settings.coupleNames ?? 'Our wedding'}
        </Link>
        <SiteNav items={nav} className="mt-4" />
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <h1 className="font-guest-display text-3xl text-balance sm:text-4xl">{title}</h1>
        {intro ? <p className="mt-3 text-guest-muted">{intro}</p> : null}
        <div className="mt-10">{children}</div>
      </main>

      <footer className="border-t border-guest-border px-6 py-8 text-center text-sm text-guest-muted">
        {settings.coupleNames ? <p>{settings.coupleNames}</p> : null}
      </footer>
    </div>
  )
}
