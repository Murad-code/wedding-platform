import path from 'path'

import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    // Wedding imagery is shown on the public guest site.
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Describes the image for screen readers. Required for accessibility.',
      },
    },
  ],
  upload: {
    /**
     * A fixed directory so a deployment can mount a volume at a known path
     * (docs/CLIENT_DEPLOYMENT.md §4). Left to a default it would follow the config file
     * around and quietly change between the local build and the container.
     */
    staticDir: process.env.MEDIA_STORAGE_DIR ?? path.resolve(process.cwd(), 'media'),

    /**
     * Raster formats only (docs/SECURITY.md T11).
     *
     * SVG is deliberately absent. The mitigation for uploads is that images are
     * re-processed by sharp, which strips anything executable — but sharp does not
     * rasterise an SVG on the way in, so an SVG is stored as submitted. It is a document
     * format that can carry script, served from the wedding's own origin, and an
     * organiser account is all it takes. A monogram can be a PNG.
     */
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  },
}
