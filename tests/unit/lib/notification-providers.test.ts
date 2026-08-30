import { afterEach, describe, expect, it, vi } from 'vitest'

import { createConsoleProvider } from '@/lib/notifications/console-provider'
import { createResendProvider } from '@/lib/notifications/resend-provider'
import { createTwilioProvider } from '@/lib/notifications/twilio-provider'

const message = {
  channel: 'email' as const,
  to: 'ada@example.test',
  subject: 'You’re next',
  body: 'Please make your way over.',
}

function mockFetch(response: { ok?: boolean; status?: number; json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: response.json ?? (() => Promise.resolve({})),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('console provider', () => {
  /** The provider logs through the structured logger, which writes JSON to stdout. */
  const captureLog = () => vi.spyOn(console, 'log').mockImplementation(() => {})
  const logged = (spy: ReturnType<typeof captureLog>) => String(spy.mock.calls[0]?.[0])

  it('always succeeds, so development and CI never depend on a network', async () => {
    const log = captureLog()
    const outcome = await createConsoleProvider('email').send(message)

    expect(outcome.ok).toBe(true)
    expect(log).toHaveBeenCalledOnce()
  })

  it('masks the recipient even in a development log', async () => {
    const log = captureLog()
    await createConsoleProvider('email').send(message)

    expect(logged(log)).not.toContain('ada@example.test')
    // Masked rather than redacted outright, so a developer can still tell two
    // recipients apart.
    expect(logged(log)).toContain('a***@example.test')
  })

  it('masks a phone number down to its last digits', async () => {
    const log = captureLog()
    await createConsoleProvider('sms').send({ ...message, channel: 'sms', to: '+447700900123' })

    expect(logged(log)).not.toContain('+447700900123')
    expect(logged(log)).toContain('***0123')
  })
})

describe('resend provider', () => {
  const provider = () => createResendProvider('key', 'us@example.test')

  it('returns the provider message id on success', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve({ id: 're_123' }) })
    expect(await provider().send(message)).toEqual({ ok: true, providerMessageId: 're_123' })
  })

  it('succeeds even when the response body is not what we expected', async () => {
    mockFetch({ ok: true, json: () => Promise.reject(new Error('not json')) })
    expect(await provider().send(message)).toEqual({ ok: true, providerMessageId: null })
  })

  it('treats rate limiting as worth retrying', async () => {
    mockFetch({ ok: false, status: 429 })
    expect(await provider().send(message)).toMatchObject({ ok: false, retryable: true })
  })

  it('treats a server error as worth retrying', async () => {
    mockFetch({ ok: false, status: 503 })
    expect(await provider().send(message)).toMatchObject({ retryable: true })
  })

  it('does not retry a rejected request', async () => {
    // A malformed address will still be malformed in four seconds.
    mockFetch({ ok: false, status: 422 })
    expect(await provider().send(message)).toMatchObject({ retryable: false })
  })

  it('treats a network failure as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')))
    expect(await provider().send(message)).toEqual({
      ok: false,
      retryable: true,
      error: 'ECONNRESET',
    })
  })

  it('never puts the API key anywhere but the Authorization header', async () => {
    const fetchMock = mockFetch({ ok: true })
    await createResendProvider('secret-key', 'us@example.test').send(message)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).not.toContain('secret-key')
    expect(String(init.body)).not.toContain('secret-key')
  })
})

describe('twilio provider', () => {
  const sms = { ...message, channel: 'sms' as const, to: '+447700900123', subject: null }
  const provider = () => createTwilioProvider('AC1', 'token', '+1555')

  it('returns the message sid on success', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve({ sid: 'SM123' }) })
    expect(await provider().send(sms)).toEqual({ ok: true, providerMessageId: 'SM123' })
  })

  it('reports Twilio’s own error code, which says more than the status', async () => {
    // 21211 is an unusable number; retrying it would just fail three more times.
    mockFetch({ ok: false, status: 400, json: () => Promise.resolve({ code: 21211 }) })
    expect(await provider().send(sms)).toMatchObject({
      ok: false,
      retryable: false,
      error: 'twilio error 21211',
    })
  })

  it('retries a server error', async () => {
    mockFetch({ ok: false, status: 500, json: () => Promise.resolve({}) })
    expect(await provider().send(sms)).toMatchObject({ retryable: true })
  })

  it('sends the body as form data, which is what Twilio accepts', async () => {
    const fetchMock = mockFetch({ ok: true, json: () => Promise.resolve({ sid: 'SM1' }) })
    await provider().send(sms)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = init.body as URLSearchParams
    expect(body.get('To')).toBe('+447700900123')
    expect(body.get('From')).toBe('+1555')
    expect(body.get('Body')).toBe('Please make your way over.')
  })

  it('does not put the auth token in the URL', async () => {
    const fetchMock = mockFetch({ ok: true, json: () => Promise.resolve({ sid: 'SM1' }) })
    await createTwilioProvider('AC1', 'super-secret', '+1555').send(sms)

    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('super-secret')
  })
})
