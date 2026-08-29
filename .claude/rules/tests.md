---
description: Testing conventions
globs: ['tests/**/*.ts', 'tests/**/*.tsx']
---

# Tests

Write tests that would **catch a real regression**. Coverage percentage is not the goal.

- `tests/unit/` — domain logic, pure functions. Fast, no database.
- `tests/int/` — Payload and database behaviour. Share one database; `fileParallelism` is
  off so fixtures cannot clobber each other.
- `tests/e2e/` — full user journeys in a browser.

Priorities (from `CLAUDE.md`): invitation-token security, RSVP including partial household
attendance, organiser authorisation, server-side validation, seating constraints,
photo-queue transitions, notification deduplication.

- Test behaviour through the public interface, not implementation details.
- Assert on accessible roles and labels (`getByRole`, `getByLabelText`) rather than CSS
  classes or test ids — this catches accessibility regressions for free.
- **Never `waitForTimeout`.** Wait for a condition. Fixed sleeps are the main source of
  flaky E2E.
- Each test creates its own data and does not depend on execution order.
- Never assert on text that varies with locale or timezone without pinning both.
- Security tests must assert the _negative_ case: the wrong token fails, the anonymous
  request is rejected, the expired deadline is refused.

Locally the dev server may run on a port other than 3000; set `PLAYWRIGHT_BASE_URL`.
