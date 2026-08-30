import { afterEach, describe, expect, it, vi } from 'vitest'

import { reportError, setErrorReporter } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

const token = 'rOHTjF42WdVkX8wILbWoeitKHjI_XXrQqhxTFRWkkCE'

function capture(method: 'log' | 'warn' | 'error') {
  return vi.spyOn(console, method).mockImplementation(() => {})
}

function parse(spy: ReturnType<typeof capture>, call = 0): Record<string, unknown> {
  return JSON.parse(String(spy.mock.calls[call]?.[0]))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  setErrorReporter(null)
})

describe('logger', () => {
  it('writes one JSON object per line', () => {
    const spy = capture('log')
    logger.info('Queue advanced', { revision: 4 })

    expect(spy.mock.calls[0]?.[0]).toMatch(/^\{.*\}$/)
    expect(parse(spy)).toMatchObject({ level: 'info', msg: 'Queue advanced', revision: 4 })
  })

  it('timestamps every line', () => {
    const spy = capture('log')
    logger.info('anything')

    expect(String(parse(spy).time)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('sends warnings and errors to stderr, where a collector expects them', () => {
    const warn = capture('warn')
    const error = capture('error')

    logger.warn('careful')
    logger.error('broken')

    expect(warn).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledOnce()
  })

  it('redacts an invitation token that reaches it in a message context', () => {
    // The whole reason logging goes through one place.
    const spy = capture('error')
    logger.error('lookup failed', { url: `/invite/${token}` })

    expect(String(spy.mock.calls[0]?.[0])).not.toContain(token)
  })

  it('redacts a sensitive key', () => {
    const spy = capture('log')
    logger.info('sending', { email: 'ada@example.test', type: 'photo.now' })

    const line = parse(spy)
    expect(line.email).toBe('[redacted]')
    expect(line.type).toBe('photo.now')
  })

  it('drops debug lines in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const spy = capture('log')

    logger.debug('noisy detail')
    expect(spy).not.toHaveBeenCalled()

    logger.info('worth keeping')
    expect(spy).toHaveBeenCalledOnce()
  })

  it('can be turned up without a rebuild', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LOG_LEVEL', 'debug')
    const spy = capture('log')

    logger.debug('now visible')
    expect(spy).toHaveBeenCalledOnce()
  })

  it('ignores a nonsense level rather than going silent', () => {
    vi.stubEnv('LOG_LEVEL', 'chatty')
    const spy = capture('log')

    logger.info('still logged')
    expect(spy).toHaveBeenCalledOnce()
  })
})

describe('reportError', () => {
  it('logs the failure with its stack, redacted', () => {
    const spy = capture('error')
    reportError(new Error(`token ${token} rejected`), { where: 'invite' })

    const line = String(spy.mock.calls[0]?.[0])
    expect(line).toContain('rejected')
    expect(line).toContain('invite')
    expect(line).not.toContain(token)
  })

  it('forwards to a registered reporter', () => {
    const reporter = vi.fn()
    capture('error')
    setErrorReporter(reporter)

    const error = new Error('boom')
    reportError(error, { where: 'dispatch' })

    expect(reporter).toHaveBeenCalledWith(error, { where: 'dispatch' })
  })

  it('does not report anywhere by default, because the guest list is not ours to send', () => {
    const spy = capture('error')
    reportError(new Error('boom'))

    expect(spy).toHaveBeenCalledOnce()
  })

  it('survives a reporter that throws', () => {
    capture('error')
    const warn = capture('warn')
    setErrorReporter(() => {
      throw new Error('sentry is down')
    })

    expect(() => reportError(new Error('boom'))).not.toThrow()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('copes with something thrown that is not an Error', () => {
    const spy = capture('error')
    reportError('just a string')

    expect(parse(spy).msg).toBe('unknown error')
  })
})
