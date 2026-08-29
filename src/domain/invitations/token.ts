import { createHash, randomBytes } from 'node:crypto'

/**
 * Invitation tokens are the guest authentication mechanism (ADR-005). A guest who holds
 * the token is treated as the party it belongs to, so the token must be unguessable and
 * must never be stored in a form that a database leak would expose.
 */

/** 32 bytes = 256 bits of entropy. Not brute-forceable at any realistic request rate. */
const TOKEN_BYTES = 32

/** base64url of 32 bytes is always 43 characters, unpadded. */
const TOKEN_LENGTH = 43

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function generateInvitationToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/**
 * Hashes a token for storage and lookup.
 *
 * SHA-256 rather than bcrypt/argon2 deliberately: slow hashes exist to protect
 * low-entropy human passwords. A 256-bit random value is not brute-forceable regardless
 * of hash speed, and a slow hash would prevent the indexed equality lookup this needs.
 * Comparison happens inside the database on the hash, so token timing is not a factor.
 */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Cheap shape check before touching the database.
 *
 * Rejects obvious junk (empty strings, SQL fragments, path traversal) without a query,
 * which keeps scanning traffic off the database and makes rate limiting more effective.
 * This is a performance guard, not a security boundary — a well-formed token is still
 * only valid if its hash exists.
 */
export function isPlausibleToken(token: unknown): token is string {
  return typeof token === 'string' && token.length === TOKEN_LENGTH && TOKEN_PATTERN.test(token)
}

/**
 * Renders a token for display in logs or error messages.
 *
 * Always returns a redaction marker. Exists so that a developer reaching for "let me just
 * log the token" finds a safe function instead (docs/SECURITY.md §2).
 */
export function redactToken(_token: string): string {
  return '[invitation-token-redacted]'
}
