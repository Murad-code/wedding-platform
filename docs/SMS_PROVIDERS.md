# SMS providers

How this platform should send texts: what is already built, which vendors to use when,
and why the “build on Textbee, swap the URL for production” advice does not fit this
repository.

This is a plan, not an implementation. No provider code changes land from this document.

## 1. What the codebase already does

SMS is not a raw HTTP call from feature code. The layers are:

| Layer                     | Responsibility                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wedding settings          | `smsNotifications` is **off by default**. Phone numbers are not collected on the RSVP unless it is on.                                                           |
| `chooseChannel`           | SMS only when the flag is on, a number is present, **and** the guest has recorded opt-in. Consent is never inferred from a number or from the household contact. |
| `enqueue` / `dispatchDue` | Write a row, return; send later (`after()`, in-process timer, or `POST /api/notifications/dispatch`). Organiser actions never wait on a vendor.                  |
| Unique `dedupeKey`        | Two “Call next” presses cannot text the same guest twice for the same group.                                                                                     |
| `NotificationProvider`    | `send({ to, body })` → `{ ok, providerMessageId, retryable, error }`. Domain code does not know Twilio.                                                          |
| `providerFor('sms')`      | Twilio **only** if `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` are all set. Otherwise **console** (log, succeed, no network).            |

There is **no inbound SMS webhook**, no delivery-status callback handler, and no
“generic SMS URL” to swap. Send outcome is whatever the outbound HTTP response says.
Textbee’s webhook story is unused unless we later add status webhooks — we should not
pick a vendor in order to consume an API we do not have.

Tests load `.env`. Integration dispatch asserts `provider === 'console'`. Photo-queue
E2E creates guests **with emails** and clicks Call next; if a live SMS provider were
selected and the wedding flag were on, that suite would burn a free-tier quota in one
run. **Automated tests must stay on the console provider.**

ADR-007 already named Twilio as the first real SMS implementation and the console
provider as the way development and CI stay free of external calls.

## 2. Verdict on the proposed two-phase plan

The **abstraction** part is already done and is the right idea.

The **Textbee-first, swap-the-URL-later** part is wrong for this project:

1. **Development is already free.** Queue logic, retries, expiry, consent, and
   deduplication are tested against the console provider and Postgres. They do not
   need a phone or a gateway to be correct.
2. **You cannot swap Textbee for Twilio or PureSMS by changing a base URL.** The
   contracts differ (auth, body shape, error codes, “from” identity). The swap is a
   new `createXProvider()` plus a branch in `providerFor()`, which is what the
   interface is for.
3. **Textbee on a personal or venue Android is a bad wedding-day dependency.** This
   product already treats venue wifi as flaky (SSE + polling). Routing “you are next”
   through a handset that must stay charged, signed in, and on data is the opposite
   of that design. A late photo-queue text is worse than silence (ADR-024).
4. **Guest numbers on a spare phone are a GDPR problem.** The handset, its backups,
   and Textbee become processors. A lost or reused phone is a breach surface we do
   not have with a hosted SMS API.
5. **Consumer SIMs are not a messaging platform.** Carriers can block or throttle
   gateway-style traffic. There is no SLA, no stable sender identity, and no clean
   story for a couple’s privacy notice.
6. **Fifty Textbee messages a day is not “plenty” if tests ever see those keys.**
   One SMS-enabled photo-queue E2E pass can spend most of that budget.

Textbee is still useful as an **optional, manual, developer-only smoke tool** — send
three texts to your own phone before a client launch. It is not the development
backend, and it is not a production provider.

## 3. Providers to use

### Development and CI (now)

**Console provider. No SMS vendor required.**

- Leave `TWILIO_*` (and any future Textbee/PureSMS vars) unset in `.env`.
- Build and test queue behaviour as today.
- If you want a live sanity check, export keys in **that shell only**, or use a file
  the test runner does not load, and send to **your own** number. Do not leave
  `pnpm dev` running with live SMS keys if Playwright might reuse that server.

Email (Resend) is the real-world fallback guests already get when SMS is off or they
have not consented. Most local testing of “did the alert fire?” is better done on
email or the notifications dashboard than on SMS.

### Optional live smoke (later, when we add a second SMS adapter)

**Textbee, developer machine only.**

- Implement as `createTextbeeProvider(...)`, selected by something like
  `SMS_PROVIDER=textbee` plus device/API credentials — **not** by overloading the
  Twilio env vars.
- Cap usage mentally: a handful of messages to numbers you control.
- Never enable `smsNotifications` in a database that E2E uses while those keys are
  loaded.
- Do not document Textbee in `docs/CLIENT_DEPLOYMENT.md` as a client option.

### Production (client wedding live)

**Twilio is the default production SMS provider.**

Why, given it costs more than PureSMS for ~200 UK texts:

- **Already implemented** and classified for retries (Twilio’s numeric codes, not
  just HTTP status).
- **Dedicated from-number.** Guests see a consistent sender; we are not borrowing a
  personal SIM. That matches consent, support (“who texted me?”), and a privacy
  notice that can name one sub-processor.
- **Not UK-only.** This repo is a template. A client wedding may have guests abroad.
  Twilio is the boring international choice; PureSMS is regionally cheaper.
- **No hardware on the day.** One container, one database, one domain (ADR-001). A
  phone in a kitchen drawer is not part of that contract.
- **~£10 per wedding** (number rental + ~200 UK SMS) is small next to the cost of a
  missed or double-sent photo call. Bake it into the client fee if you want; do not
  optimise the architecture around £4.

**PureSMS** is a reasonable **second production adapter** if a specific client is
UK-only, volume stays tiny, and they want the lower unit price. Add it when that
client exists — a thin `fetch` wrapper, same as Resend/Twilio — not before. Do not
make it the development target.

**Textbee in production (including “unlimited SIM in a cupboard”)** is rejected.
Fragile, poor GDPR posture, carrier risk, and it fights the reliability model of the
photo queue.

## 4. Cost and volume (sense-check)

Wedding-day SMS in this product is only `photo.get-ready` and `photo.now`, and only
for guests who opted in. Two texts × consented guests is the right order of
magnitude; **~200 SMS per client** is a fair planning cap if SMS is turned on and
uptake is high.

| Setup                 | Role                   | Rough cost at 200 UK SMS                | Use?                             |
| --------------------- | ---------------------- | --------------------------------------- | -------------------------------- |
| Console               | Dev, CI, default local | £0                                      | **Yes — default**                |
| Textbee (own Android) | Manual smoke only      | £0 + your airtime; 50/day cap           | Optional, never in tests or prod |
| Twilio                | Production default     | ~£8–£10 incl. number                    | **Yes**                          |
| PureSMS               | Optional UK-only prod  | ~£5.60, no number rental in their pitch | Later, per client                |
| Textbee on-site       | “Free” production      | Hidden: hardware, SIM, wifi, theft      | **No**                           |

Twilio’s UK sender-registration rules are real. They are a **launch checklist item**
for a live client (register the number, keep the privacy notice accurate), not a
reason to avoid the provider we already shipped.

## 5. Implementation plan (when we next touch SMS)

Do this in order. Stop after the step you actually need.

1. **Keep the current default.** No keys in `.env`. Console in tests. Twilio env vars
   remain the production switch. Update the client privacy-notice list when a
   wedding actually enables SMS (already required in `docs/SECURITY.md` §7).
2. **If a developer needs a live text before first client launch:** add a Textbee
   provider behind `SMS_PROVIDER`, with unit tests that mock `fetch` (same pattern
   as `tests/unit/lib/notification-providers.test.ts`). Document the vars in
   `.env.example` as commented, developer-only. Add an ADR superseding nothing in
   ADR-007 except “Twilio is the only real SMS adapter.”
3. **If a UK-only client wants PureSMS:** add `createPureSmsProvider` the same way.
   `providerFor` becomes an explicit selector (`SMS_PROVIDER=twilio|puresms|textbee`),
   never “whichever URL is in the env.”
4. **Do not** add delivery webhooks unless we have a product reason (dashboard
   “delivered” vs “accepted by the API”). Outbound response + organiser retry is
   enough for MVP photo-queue alerts.
5. **Do not** route automated tests through any live gateway. If we add a safety
   rail later, it should be: refuse live SMS when `NODE_ENV !== 'production'` unless
   `ALLOW_LIVE_SMS=1`.

## 6. Decision

| Question                               | Answer                                                      |
| -------------------------------------- | ----------------------------------------------------------- |
| Build queue logic on Textbee now?      | No. Console + existing Twilio adapter.                      |
| Use Textbee to save free-tier pain?    | Only as a rare manual smoke. Tests must not see those keys. |
| Production SMS?                        | Twilio, unless a later client justifies PureSMS.            |
| Production Textbee / phone-on-site?    | No.                                                         |
| Swap providers by changing an API URL? | No. New provider module + `providerFor`.                    |

Email (Resend) stays independent. Turning SMS off does not block launching a
wedding; most guests can be reached by email, which is already the fallback in
`chooseChannel`.
