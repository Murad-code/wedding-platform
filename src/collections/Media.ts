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
    // Uploads are restricted by MIME type; see docs/SECURITY.md T11.
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'],
  },
}
