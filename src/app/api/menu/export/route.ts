import { requireOrganiser } from '@/lib/auth/session'
import { cateringCsv, getCateringReport, getMenu } from '@/lib/menu'

export const dynamic = 'force-dynamic'

/**
 * The caterer's list: one row per attending guest with their choices spelled out.
 *
 * Contains guest names, allergies, and dietary requirements — special-category data
 * under GDPR — so it is authorised like any other organiser endpoint and never cached.
 */
export async function GET() {
  await requireOrganiser()

  const [report, menu] = await Promise.all([getCateringReport(), getMenu()])
  const date = new Date().toISOString().slice(0, 10)

  return new Response(cateringCsv(report, menu), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="catering-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
