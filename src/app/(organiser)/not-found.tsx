import Link from 'next/link'

export default function OrganiserNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-organiser-muted">
        It may have been deleted, or the link may be out of date.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-md border border-organiser-border px-3 py-1.5 text-sm font-medium hover:bg-organiser-surface"
      >
        Back to the dashboard
      </Link>
    </main>
  )
}
