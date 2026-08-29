import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'Wedding dashboard',
  // The organiser surface must never be indexed.
  robots: { index: false, follow: false },
}

export default function OrganiserLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-organiser-bg font-organiser text-organiser-ink antialiased">
        {children}
      </body>
    </html>
  )
}
