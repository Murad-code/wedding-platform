import type { s3Storage } from '@payloadcms/storage-s3'

type S3StorageOptions = Parameters<typeof s3Storage>[0]

const REQUIRED_WITH_BUCKET = ['S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const

/**
 * Where uploaded media lives: an S3-compatible bucket when `S3_BUCKET` is set, local disk
 * otherwise (docs/CLIENT_DEPLOYMENT.md §4).
 */
export function s3StorageFromEnv(env: Record<string, string | undefined>): S3StorageOptions {
  const shared = {
    // Both needed for one media schema in every deployment: alwaysInsertFields adds `prefix`
    // when S3 is off, and an explicit empty prefix is what makes the plugin add it when on.
    collections: { media: { prefix: '' } },
    alwaysInsertFields: true,
    // The bucket stays private; files are served through /api/media, which carries the
    // sandboxed CSP and Payload's access control.
    acl: 'private' as const,
  }

  const bucket = env.S3_BUCKET?.trim()
  if (!bucket) return { ...shared, enabled: false, bucket: '', config: {} }

  // A half-configured bucket must stop the deploy rather than quietly fall back to disk.
  const missing = REQUIRED_WITH_BUCKET.filter((name) => !env[name]?.trim())
  if (missing.length > 0) {
    throw new Error(`S3_BUCKET is set, so these must be set too: ${missing.join(', ')}`)
  }

  return {
    ...shared,
    enabled: true,
    bucket,
    config: {
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT?.trim() || undefined,
      // Path-style addressing is what local S3 servers and some providers need.
      forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
      },
    },
  }
}
