'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import { z } from 'zod'

import { FEATURES } from '@/domain/wedding/features'
import { recordAuditEvent } from '@/lib/audit'
import { requireMutator } from '@/lib/auth/session'

export type SettingsState = { error?: string; ok?: boolean }

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .refine((value) => value === null || !Number.isNaN(new Date(value).getTime()), {
    message: 'That date could not be understood.',
  })

const venueSchema = z.object({
  venueName: optionalText(200),
  address: optionalText(500),
  mapUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === '' || /^https?:\/\//.test(value), {
      message: 'Map links must start with http:// or https://',
    })
    .transform((value) => (value.length === 0 ? null : value)),
  startTime: optionalDate,
  notes: optionalText(1000),
})

const settingsSchema = z.object({
  partnerOneName: z.string().trim().min(1, 'Both names are required').max(100),
  partnerTwoName: z.string().trim().min(1, 'Both names are required').max(100),
  // Required, matching the global: the date drives the countdown, the RSVP deadline,
  // and every date shown on the guest site, so a wedding without one is not configured.
  weddingDate: z
    .string()
    .trim()
    .min(1, 'A wedding date is required')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: 'That date could not be understood.',
    }),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isValidTimezone, { message: 'That is not a recognised timezone.' }),
  rsvpDeadline: optionalDate,
  dressCode: optionalText(200),
  welcomeMessage: optionalText(2000),
  travelInformation: optionalText(2000),
  parkingInformation: optionalText(2000),
  accommodationInformation: optionalText(2000),
  ceremony: venueSchema,
  reception: venueSchema,
  enabledFeatures: z.array(z.enum(FEATURES)),
})

/**
 * Validated rather than trusted: an unrecognised IANA name would make every date on the
 * guest site throw at format time.
 */
function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value })
    return true
  } catch {
    return false
  }
}

function venueFrom(formData: FormData, prefix: string) {
  return {
    venueName: String(formData.get(`${prefix}.venueName`) ?? ''),
    address: String(formData.get(`${prefix}.address`) ?? ''),
    mapUrl: String(formData.get(`${prefix}.mapUrl`) ?? ''),
    startTime: String(formData.get(`${prefix}.startTime`) ?? ''),
    notes: String(formData.get(`${prefix}.notes`) ?? ''),
  }
}

export async function updateWeddingSettings(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await requireMutator()

  const parsed = settingsSchema.safeParse({
    partnerOneName: String(formData.get('partnerOneName') ?? ''),
    partnerTwoName: String(formData.get('partnerTwoName') ?? ''),
    weddingDate: String(formData.get('weddingDate') ?? ''),
    timezone: String(formData.get('timezone') ?? 'Europe/London'),
    rsvpDeadline: String(formData.get('rsvpDeadline') ?? ''),
    dressCode: String(formData.get('dressCode') ?? ''),
    welcomeMessage: String(formData.get('welcomeMessage') ?? ''),
    travelInformation: String(formData.get('travelInformation') ?? ''),
    parkingInformation: String(formData.get('parkingInformation') ?? ''),
    accommodationInformation: String(formData.get('accommodationInformation') ?? ''),
    ceremony: venueFrom(formData, 'ceremony'),
    reception: venueFrom(formData, 'reception'),
    enabledFeatures: formData.getAll('enabledFeatures').map(String),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those details were not valid.' }
  }

  const payload = await getPayload({ config })
  await payload.updateGlobal({
    slug: 'wedding-settings',
    overrideAccess: true,
    data: parsed.data,
  })

  await recordAuditEvent({
    action: 'settings.updated',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'wedding-settings',
  })

  // The guest site reads these on every page.
  revalidatePath('/', 'layout')
  revalidatePath('/dashboard')
  return { ok: true }
}
