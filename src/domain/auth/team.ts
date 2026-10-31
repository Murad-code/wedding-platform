import type { Role } from './roles'

export type TeamMember = { id: number | string; role: Role }

export type TeamChangeCheck = { ok: true } | { ok: false; reason: string }

const sameId = (a: number | string, b: number | string) => String(a) === String(b)

function adminsAfter(
  team: readonly TeamMember[],
  targetId: number | string,
  targetRole: Role | null,
): number {
  return team.filter((member) =>
    sameId(member.id, targetId) ? targetRole === 'admin' : member.role === 'admin',
  ).length
}

const LAST_ADMIN =
  'There must always be at least one admin, otherwise nobody could manage the team.'

/**
 * Whether `actorId` may give `targetId` a new role.
 *
 * `actorId` is null for scripts and system operations, which skip the self rule but never
 * the last-admin rule.
 */
export function checkRoleChange(
  team: readonly TeamMember[],
  actorId: number | string | null,
  targetId: number | string,
  newRole: Role,
): TeamChangeCheck {
  const target = team.find((member) => sameId(member.id, targetId))
  if (!target) return { ok: false, reason: 'That account no longer exists.' }
  if (target.role === newRole) return { ok: true }

  if (actorId !== null && sameId(actorId, targetId)) {
    return { ok: false, reason: 'You cannot change your own role. Ask another admin.' }
  }
  if (adminsAfter(team, targetId, newRole) === 0) return { ok: false, reason: LAST_ADMIN }

  return { ok: true }
}

export function checkRemoval(
  team: readonly TeamMember[],
  actorId: number | string | null,
  targetId: number | string,
): TeamChangeCheck {
  const target = team.find((member) => sameId(member.id, targetId))
  if (!target) return { ok: false, reason: 'That account no longer exists.' }

  if (actorId !== null && sameId(actorId, targetId)) {
    return { ok: false, reason: 'You cannot remove your own account. Ask another admin.' }
  }
  if (adminsAfter(team, targetId, null) === 0) return { ok: false, reason: LAST_ADMIN }

  return { ok: true }
}

/** The same floor as `pnpm create-admin`, so no route creates a weaker password. */
export const MIN_PASSWORD_LENGTH = 12
