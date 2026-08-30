/**
 * Redaction for anything on its way into a log.
 *
 * `docs/SECURITY.md` §7 forbids logging passwords, secrets, raw invitation tokens, and
 * unnecessary guest PII. Relying on every call site to remember that is how leaks happen,
 * so redaction is applied centrally to whatever a caller passes and errs towards removing
 * too much: an over-redacted log line is a mild inconvenience, a token in a log file is an
 * incident.
 */

export const REDACTED = '[redacted]'
export const TOKEN_REDACTED = '[invitation-token-redacted]'

/**
 * Keys whose value is never safe to log.
 *
 * Matched as substrings against a lower-cased key, so `contactEmail`, `guest_email`, and
 * `EMAIL` are all caught without listing every spelling.
 */
const SENSITIVE_KEY_PARTS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'credential',
  'session',
  'email',
  'phone',
  'mobile',
  'dietary',
  'allergies',
  'accessibility',
  'address',
]

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_PARTS.some((part) => lower.includes(part))
}

/** base64url of 32 bytes: exactly 43 characters, and how every invitation token looks. */
const TOKEN_PATTERN = /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g

/**
 * Requires letters after the final dot, so a package path like `@vitest+runner@4.1.11`
 * in a stack trace survives intact. An unreadable stack is its own kind of failure.
 */
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[A-Za-z]{2,}\b/g

/** Nine or more digits, however they are spaced — enough to be somebody's number. */
const PHONE_PATTERN = /\+?\d[\d\s().-]{8,}\d/g

/**
 * Redacts sensitive values *inside* a string.
 *
 * Necessary because the dangerous things rarely arrive as a tidy field: a token turns up
 * in a URL inside an error message, an email address inside a database constraint
 * violation.
 */
export function redactString(value: string): string {
  return value
    .replace(TOKEN_PATTERN, TOKEN_REDACTED)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(PHONE_PATTERN, REDACTED)
}

/** Beyond this, a log line is noise rather than evidence. */
const MAX_DEPTH = 6
const MAX_ARRAY = 50
const MAX_STRING = 2_000

/**
 * Recursively redacts a value for logging.
 *
 * Cycles, over-deep objects, and enormous arrays are truncated rather than followed —
 * a logger that can hang or exhaust memory on a malformed object is a liability of its
 * own.
 */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value

  if (typeof value === 'string') {
    const redacted = redactString(value)
    return redacted.length > MAX_STRING ? `${redacted.slice(0, MAX_STRING)}…[truncated]` : redacted
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'function' || typeof value === 'symbol') return '[omitted]'

  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      // Stacks carry file paths and sometimes URLs; keep them, redacted.
      stack: value.stack ? redactString(value.stack) : undefined,
    }
  }

  if (depth >= MAX_DEPTH) return '[depth-limit]'

  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]'
    seen.add(value)

    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ARRAY).map((item) => redact(item, depth + 1, seen))
      return value.length > MAX_ARRAY ? [...items, `…and ${value.length - MAX_ARRAY} more`] : items
    }

    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      result[key] = isSensitiveKey(key) ? REDACTED : redact(entry, depth + 1, seen)
    }
    return result
  }

  return '[omitted]'
}
