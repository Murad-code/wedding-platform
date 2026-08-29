import { z } from 'zod'

/**
 * Environment is validated once, at the edge of the process, so a misconfigured
 * deployment fails immediately with a clear message rather than surfacing as a
 * confusing runtime error hours later.
 *
 * Secrets are never logged — only the *names* of missing variables are reported.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PAYLOAD_SECRET: z
    .string()
    .min(32, 'PAYLOAD_SECRET must be at least 32 characters and unique per deployment'),
  NEXT_PUBLIC_SERVER_URL: z.string().url().optional(),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function getEnv(): Env {
  if (cached) return cached

  const parsed = schema.safeParse(process.env)

  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid environment configuration:\n${missing.join('\n')}`)
  }

  cached = parsed.data
  return cached
}

export const isProduction = () => process.env.NODE_ENV === 'production'
