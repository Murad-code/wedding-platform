'use server'

import config from '@payload-config'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { z } from 'zod'

import { MIN_PASSWORD_LENGTH } from '@/domain/auth/team'
import { recordAuditEvent } from '@/lib/audit'
import { requireOrganiser } from '@/lib/auth/session'

export type AccountState = { error?: string }

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      .max(200),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'The new passwords do not match.',
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: 'Choose a different password from your current one.',
  })

export async function changeOwnPassword(
  _previous: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const session = await requireOrganiser()

  const parsed = schema.safeParse({
    currentPassword: formData.get('currentPassword') ?? '',
    newPassword: formData.get('newPassword') ?? '',
    confirmPassword: formData.get('confirmPassword') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the passwords.' }

  const payload = await getPayload({ config })

  // A stolen session cookie alone must not be enough to take over the account.
  try {
    await payload.login({
      collection: 'users',
      data: { email: session.email, password: parsed.data.currentPassword },
    })
  } catch {
    return { error: 'That is not your current password.' }
  }

  await payload.update({
    collection: 'users',
    id: session.actor.id,
    data: { password: parsed.data.newPassword, sessions: [] },
    overrideAccess: true,
  })

  await recordAuditEvent({
    action: 'account.password-changed',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'users',
    entityId: String(session.actor.id),
  })

  // Every session was just cleared, this one included, so the cookie is already dead.
  ;(await cookies()).delete('payload-token')
  redirect('/login?passwordChanged=1')
}
