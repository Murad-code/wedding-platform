// @vitest-environment node
import { existsSync } from 'node:fs'
import path from 'node:path'

import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Media } from '@/payload-types'

// Runs only with a bucket configured, e.g. against `docker compose --profile s3 up -d s3`
// (see docs/CLIENT_DEPLOYMENT.md §4); CI runs it against the same local server.
const bucket = process.env.S3_BUCKET

describe.skipIf(!bucket)('media in S3-compatible storage', () => {
  let payload: Payload
  let s3: S3Client
  let uploaded: Media

  const objectExists = async (key: string) =>
    s3
      .send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      .then(() => true)
      .catch(() => false)

  beforeAll(async () => {
    payload = await getPayload({ config })
    s3 = new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      },
    })

    const image = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#c0ffee' },
    })
      .png()
      .toBuffer()

    uploaded = await payload.create({
      collection: 'media',
      overrideAccess: true,
      data: { alt: 'Storage test' },
      file: {
        data: image,
        mimetype: 'image/png',
        name: `storage-${Date.now()}.png`,
        size: image.length,
      },
    })
  })

  afterAll(async () => {
    if (uploaded) {
      await payload
        .delete({ collection: 'media', id: uploaded.id, overrideAccess: true })
        .catch(() => undefined)
    }
  })

  it('writes the upload to the bucket', async () => {
    expect(await objectExists(uploaded.filename ?? '')).toBe(true)
  })

  it('does not also keep a copy on local disk', () => {
    // A container's disk is lost on redeploy; a file that silently landed there would vanish.
    const local = path.resolve(process.cwd(), 'media', uploaded.filename ?? '')
    expect(existsSync(local)).toBe(false)
  })

  it('serves the file through the app rather than a public bucket URL', () => {
    expect(uploaded.url).toMatch(/^\/api\/media\/file\//)
  })

  it('removes the object from the bucket when the media is deleted', async () => {
    await payload.delete({ collection: 'media', id: uploaded.id, overrideAccess: true })
    expect(await objectExists(uploaded.filename ?? '')).toBe(false)
  })
})
