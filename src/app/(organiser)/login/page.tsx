import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LoginForm } from '@/components/organiser/login-form'
import { sanitiseRedirect } from '@/domain/auth/redirect'
import { getSession } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await getSession()
  if (session) redirect('/dashboard')

  const { next } = await searchParams

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Wedding dashboard</h1>
        <p className="mt-2 text-sm text-organiser-muted">Sign in to manage your wedding.</p>
        <LoginForm redirectTo={sanitiseRedirect(next)} />
      </div>
    </main>
  )
}
