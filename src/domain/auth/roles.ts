/**
 * Organiser roles and what each may do.
 *
 * These predicates are the single definition of "may this person do that". Payload
 * access functions, route guards, and UI affordances all call them, so a permission
 * cannot be defined one way on the server and another way in the interface.
 */

export const ROLES = ['admin', 'organiser', 'viewer'] as const

export type Role = (typeof ROLES)[number]

/** The shape this layer needs from a user. Deliberately narrower than Payload's type. */
export type Actor = {
  id: number | string
  role: Role
} | null

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/** Admins manage team access and reach Payload Admin. */
export function isAdmin(actor: Actor): boolean {
  return actor?.role === 'admin'
}

/** Anyone signed in may read the organiser dashboard. */
export function canRead(actor: Actor): boolean {
  return actor !== null
}

/**
 * Viewers are read-only — the wedding planner or helpful sibling who should not be able
 * to delete the guest list.
 */
export function canMutate(actor: Actor): boolean {
  return actor?.role === 'admin' || actor?.role === 'organiser'
}

/** Only admins may create, edit, or remove organiser accounts and change roles. */
export function canManageTeam(actor: Actor): boolean {
  return isAdmin(actor)
}
