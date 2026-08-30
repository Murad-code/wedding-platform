import { logger } from './logger'

/**
 * A seam for an error tracker, with no error tracker behind it.
 *
 * Wiring Sentry into a wedding platform means sending a third party fragments of a real
 * guest list, which is a decision for the couple and their privacy notice — not something
 * this repository should make on their behalf (docs/SECURITY.md §7). So the platform
 * reports through this function, logs everything itself, and a deployment that wants
 * Sentry registers a reporter at startup:
 *
 * ```ts
 * import * as Sentry from '@sentry/node'
 * setErrorReporter((error, context) => Sentry.captureException(error, { extra: context }))
 * ```
 *
 * Anything registered here receives the raw error, so a reporter is responsible for its
 * own scrubbing — which is why the default is nothing at all.
 */

export type ErrorReporter = (error: unknown, context?: Record<string, unknown>) => void

const REGISTRY = Symbol.for('wedding-platform.error-reporter')

const store = globalThis as typeof globalThis & { [REGISTRY]?: ErrorReporter | null }

export function setErrorReporter(reporter: ErrorReporter | null): void {
  store[REGISTRY] = reporter
}

/**
 * Records an unexpected failure.
 *
 * Always logs, redacted. Never throws: an error in the error path would replace a
 * diagnosable problem with an undiagnosable one.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : 'unknown error'

  logger.error(message, { ...context, error })

  try {
    store[REGISTRY]?.(error, context)
  } catch {
    logger.warn('Error reporter threw and was ignored')
  }
}
