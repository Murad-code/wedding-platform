import config from '@payload-config'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

/**
 * Readiness probe for Caddy and uptime monitoring (docs/ARCHITECTURE.md §10).
 * Deliberately reports only reachability — never versions, connection strings,
 * or anything else useful to an attacker.
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = { app: 'ok', database: 'error' }

  try {
    const payload = await getPayload({ config })
    await payload.db.drizzle.execute('SELECT 1')
    checks.database = 'ok'
  } catch (error) {
    console.error('Health check: database unreachable', {
      message: error instanceof Error ? error.message : 'unknown error',
    })
  }

  const healthy = Object.values(checks).every((status) => status === 'ok')

  return Response.json(
    { status: healthy ? 'healthy' : 'unhealthy', checks },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
