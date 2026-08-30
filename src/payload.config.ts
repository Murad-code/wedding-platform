import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { AuditEvents } from './collections/AuditEvents'
import { Guests } from './collections/Guests'
import { GuestMealSelections } from './collections/GuestMealSelections'
import { InvitationParties } from './collections/InvitationParties'
import { ItineraryItems } from './collections/ItineraryItems'
import { MenuCourses } from './collections/MenuCourses'
import { MenuOptions } from './collections/MenuOptions'
import { Media } from './collections/Media'
import { Notifications } from './collections/Notifications'
import { PhotoGroups } from './collections/PhotoGroups'
import { Tables } from './collections/Tables'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
import { WeddingContacts } from './collections/WeddingContacts'
import { PhotoQueueState } from './globals/PhotoQueueState'
import { WeddingSettings } from './globals/WeddingSettings'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '— Wedding Platform',
    },
  },
  collections: [
    Users,
    InvitationParties,
    Guests,
    Tags,
    Tables,
    MenuCourses,
    MenuOptions,
    GuestMealSelections,
    PhotoGroups,
    ItineraryItems,
    WeddingContacts,
    Media,
    Notifications,
    AuditEvents,
  ],
  globals: [WeddingSettings, PhotoQueueState],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Migrations run as an explicit deploy step, never implicitly on boot.
    // See docs/CLIENT_DEPLOYMENT.md §7.
    push: process.env.NODE_ENV !== 'production',
  }),
  sharp,
  plugins: [],
})
