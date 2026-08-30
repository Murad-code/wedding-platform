import config from '@payload-config'
import { getPayload } from 'payload'

import { reportError } from '@/lib/error-reporting'

export const dynamic = 'force-dynamic'

/**
 * Readiness probe for Caddy and uptime monitoring (docs/ARCHITECTURE.md §10).
 * Deliberately reports only reachability — never versions, connection strings,
 * or anything else useful to an attacker.
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = { app: 'ok', database: 'error', schema: 'error' }

  try {
    const payload = await getPayload({ config })

    await payload.db.drizzle.execute('SELECT 1')
    checks.database = 'ok'

    /**
     * Connectivity is not readiness.
     *
     * A deployment whose migrations have not run connects perfectly well and then serves
     * 500s on every page — which a `SELECT 1` probe calls healthy, so the proxy sends it
     * traffic and the uptime monitor stays green. Found by the deployment dry run
     * (docs/IMPLEMENTATION_PLAN.md, Phase 9), which is what a dry run is for.
     *
     * `to_regclass` returns null rather than raising when the table is absent, so this
     * distinguishes "no schema yet" from "database unreachable" without introducing a
     * failure mode of its own.
     */
    const schema = await payload.db.drizzle.execute(
      "SELECT to_regclass('public.payload_migrations') IS NOT NULL AS present",
    )
    const row = (schema as { rows?: { present?: unknown }[] }).rows?.[0]
    checks.schema = row?.present === true ? 'ok' : 'error'
  } catch (error) {
    reportError(error, { check: 'database' })
  }

  const healthy = Object.values(checks).every((status) => status === 'ok')

  return Response.json(
    { status: healthy ? 'healthy' : 'unhealthy', checks },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
