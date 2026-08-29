import type { Access } from 'payload'

import { type Actor, canManageTeam, canMutate, canRead, isAdmin, isRole } from './roles'

/**
 * Adapts Payload's request user to the narrow {@link Actor} the domain reasons about,
 * so role logic stays free of Payload types and remains unit-testable.
 */
export function toActor(user: unknown): Actor {
  if (!user || typeof user !== 'object') return null

  const candidate = user as { id?: unknown; role?: unknown }
  if (candidate.id === undefined || candidate.id === null) return null
  if (!isRole(candidate.role)) return null
  if (typeof candidate.id !== 'string' && typeof candidate.id !== 'number') return null

  return { id: candidate.id, role: candidate.role }
}

/**
 * Collection access functions. The default posture is deny: anonymous requests get
 * nothing unless a collection explicitly opts into public read (docs/SECURITY.md §5).
 */
export const authenticated: Access = ({ req }) => canRead(toActor(req.user))
export const mutator: Access = ({ req }) => canMutate(toActor(req.user))
export const adminOnly: Access = ({ req }) => isAdmin(toActor(req.user))
export const teamManager: Access = ({ req }) => canManageTeam(toActor(req.user))
export const nobody: Access = () => false
export const anyone: Access = () => true
