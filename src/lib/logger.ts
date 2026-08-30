import { redact, redactString } from '@/domain/logging/redact'

/**
 * Structured logging.
 *
 * One JSON object per line, because in production these are read by a log collector and
 * grep, not by a person watching a terminal. Every context object passes through
 * {@link redact} first — this is the single place that guarantee is made, rather than
 * asking each call site to remember what must not be logged (docs/SECURITY.md §7).
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

const SEVERITY: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

/**
 * Read per call rather than cached, so raising the level to debug during an incident does
 * not require a rebuild — only a restart.
 */
function threshold(): number {
  const configured = process.env.LOG_LEVEL
  if (configured && configured in SEVERITY) return SEVERITY[configured as LogLevel]
  return process.env.NODE_ENV === 'production' ? SEVERITY.info : SEVERITY.debug
}

export type LogContext = Record<string, unknown>

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (SEVERITY[level] < threshold()) return

  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    // The message is redacted too. A caller logging `error.message` directly is the
    // easiest way for a token to reach a log, and it is not a mistake worth relying on
    // people not making.
    msg: redactString(message),
    ...(context ? (redact(context) as LogContext) : {}),
  })

  // The one place in the application permitted to write to the console; everything else
  // goes through this module so redaction cannot be skipped. Warnings and errors go to
  // stderr, which is where a container log collector expects to find them.
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  // eslint-disable-next-line no-console -- this module is the sanctioned writer
  else console.log(line)
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
}
