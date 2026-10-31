'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import { z } from 'zod'

import { isRole, ROLES } from '@/domain/auth/roles'
import {
  checkRemoval,
  checkRoleChange,
  MIN_PASSWORD_LENGTH,
  type TeamMember,
} from '@/domain/auth/team'
import { recordAuditEvent } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/session'

export type TeamState = { error?: string; ok?: boolean; message?: string }

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(200)

const idSchema = z.coerce.number().int().positive()

async function currentTeam(): Promise<TeamMember[]> {
  const payload = await getPayload({ config })
  const users = await payload.find({
    collection: 'users',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  return users.docs.flatMap((user) => (isRole(user.role) ? [{ id: user.id, role: user.role }] : []))
}

const addSchema = z.object({
  name: z.string().trim().min(1, 'Add their name.').max(100),
  email: z.string().trim().toLowerCase().email('That does not look like an email address.'),
  role: z.enum(ROLES),
  password,
})

export async function addTeamMember(_previous: TeamState, formData: FormData): Promise<TeamState> {
  const session = await requireAdmin()

  const parsed = addSchema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    role: formData.get('role') ?? 'organiser',
    password: formData.get('password') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the details.' }

  const payload = await getPayload({ config })

  const existing = await payload.count({
    collection: 'users',
    where: { email: { equals: parsed.data.email } },
    overrideAccess: true,
  })
  if (existing.totalDocs > 0) return { error: 'There is already an account for that email.' }

  const created = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: parsed.data,
  })

  await recordAuditEvent({
    action: 'team.member-added',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'users',
    entityId: String(created.id),
    metadata: { role: parsed.data.role },
  })

  revalidatePath('/dashboard/team')
  return {
    ok: true,
    message: `Added ${parsed.data.name}. Share their password with them privately.`,
  }
}

export async function changeTeamMemberRole(
  _previous: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requireAdmin()

  const parsed = z
    .object({ id: idSchema, role: z.enum(ROLES) })
    .safeParse({ id: formData.get('id'), role: formData.get('role') })
  if (!parsed.success) return { error: 'That change was not valid.' }

  const check = checkRoleChange(
    await currentTeam(),
    session.actor.id,
    parsed.data.id,
    parsed.data.role,
  )
  if (!check.ok) return { error: check.reason }

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'users',
    id: parsed.data.id,
    data: { role: parsed.data.role },
    overrideAccess: true,
  })

  await recordAuditEvent({
    action: 'team.role-changed',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'users',
    entityId: String(parsed.data.id),
    metadata: { role: parsed.data.role },
  })

  revalidatePath('/dashboard/team')
  return { ok: true, message: 'Role updated.' }
}

export async function removeTeamMember(
  _previous: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requireAdmin()

  const id = idSchema.safeParse(formData.get('id'))
  if (!id.success) return { error: 'That account could not be found.' }

  const check = checkRemoval(await currentTeam(), session.actor.id, id.data)
  if (!check.ok) return { error: check.reason }

  const payload = await getPayload({ config })
  await payload.delete({ collection: 'users', id: id.data, overrideAccess: true })

  await recordAuditEvent({
    action: 'team.member-removed',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'users',
    entityId: String(id.data),
  })

  revalidatePath('/dashboard/team')
  return { ok: true }
}

export async function setTeamMemberPassword(
  _previous: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requireAdmin()

  const parsed = z
    .object({ id: idSchema, password })
    .safeParse({ id: formData.get('id'), password: formData.get('password') ?? '' })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the password.' }

  // Your own password needs your current one, which only the account page asks for.
  if (String(parsed.data.id) === String(session.actor.id)) {
    return { error: 'Change your own password from your account page.' }
  }

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'users',
    id: parsed.data.id,
    // Signs them out everywhere, so a reset also cuts off anyone using the old password.
    data: { password: parsed.data.password, sessions: [] },
    overrideAccess: true,
  })

  await recordAuditEvent({
    action: 'team.password-reset',
    actorType: 'user',
    actorUserId: session.actor.id,
    entityType: 'users',
    entityId: String(parsed.data.id),
  })

  return { ok: true, message: 'Password set. They have been signed out everywhere.' }
}
