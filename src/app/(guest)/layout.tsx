import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'Wedding',
  description: 'Wedding website',
}

export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-guest-bg font-guest-body text-guest-ink antialiased">
        {children}
      </body>
    </html>
  )
}
