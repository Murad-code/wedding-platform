import { describe, expect, it } from 'vitest'

import { s3StorageFromEnv } from '@/lib/storage'

const full = {
  S3_BUCKET: 'sarah-and-adam',
  S3_REGION: 'auto',
  S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  S3_ACCESS_KEY_ID: 'key-id',
  S3_SECRET_ACCESS_KEY: 'secret-value',
}

describe('s3StorageFromEnv', () => {
  it('stays on local disk when no bucket is configured', () => {
    expect(s3StorageFromEnv({})).toMatchObject({ enabled: false })
  })

  it('treats a blank bucket as no bucket', () => {
    expect(s3StorageFromEnv({ S3_BUCKET: '  ' })).toMatchObject({ enabled: false })
  })

  it('keeps the media schema the same whether S3 is on or off', () => {
    // Otherwise the committed migration would be wrong for one kind of deployment.
    expect(s3StorageFromEnv({}).alwaysInsertFields).toBe(true)
    expect(s3StorageFromEnv(full).alwaysInsertFields).toBe(true)
  })

  it('uses the bucket when fully configured', () => {
    expect(s3StorageFromEnv(full)).toMatchObject({
      enabled: true,
      bucket: 'sarah-and-adam',
      acl: 'private',
      collections: { media: { prefix: '' } },
      config: {
        region: 'auto',
        endpoint: 'https://account.r2.cloudflarestorage.com',
        forcePathStyle: false,
        credentials: { accessKeyId: 'key-id', secretAccessKey: 'secret-value' },
      },
    })
  })

  it('refuses to start with a half-configured bucket, naming what is missing', () => {
    expect(() => s3StorageFromEnv({ S3_BUCKET: 'b', S3_REGION: 'auto' })).toThrow(
      /S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY/,
    )
  })

  it('names missing variables without echoing any value that was set', () => {
    try {
      s3StorageFromEnv({ ...full, S3_REGION: '' })
    } catch (error) {
      expect(String(error)).toContain('S3_REGION')
      expect(String(error)).not.toContain('secret-value')
    }
    expect.assertions(2)
  })

  it('switches to path-style addressing only when asked', () => {
    expect(s3StorageFromEnv({ ...full, S3_FORCE_PATH_STYLE: 'true' }).config.forcePathStyle).toBe(
      true,
    )
  })

  it('talks to AWS itself when no endpoint is given', () => {
    expect(s3StorageFromEnv({ ...full, S3_ENDPOINT: '' }).config.endpoint).toBeUndefined()
  })
})
