export default function InvitationNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-guest-display text-3xl">We couldn’t find that invitation</h1>
      <p className="mt-4 text-guest-muted">
        The link may be incomplete, or it may have been replaced with a newer one. Check the message
        you received, or get in touch with the couple.
      </p>
    </main>
  )
}
