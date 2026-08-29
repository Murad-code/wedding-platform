import { parseGuestFilters } from '@/domain/guests/filters'
import { requireOrganiser } from '@/lib/auth/session'
import { exportGuestsCsv } from '@/lib/guest-list'

export const dynamic = 'force-dynamic'

/**
 * Downloads the guest list as CSV, honouring the current filters.
 *
 * A route handler rather than a server action because the response is a file. Guest data
 * is personal, so this is authorised like any other organiser endpoint and never cached.
 */
export async function GET(request: Request) {
  await requireOrganiser()

  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  const csv = await exportGuestsCsv(parseGuestFilters(params))

  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="guest-list-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
