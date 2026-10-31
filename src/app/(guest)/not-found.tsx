import Link from 'next/link'

// No data fetching: a missing page still has to render when the database is the problem.
export default function GuestNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-guest-display text-3xl">We couldn’t find that page</h1>
      <p className="mt-4 text-guest-muted">
        It may have moved, or the link may be incomplete. If it came from a message about the
        wedding, check you have the whole link.
      </p>
      <Link
        href="/"
        className="mt-8 text-sm tracking-[0.15em] uppercase underline-offset-4 hover:underline"
      >
        Back to the wedding website
      </Link>
    </main>
  )
}
