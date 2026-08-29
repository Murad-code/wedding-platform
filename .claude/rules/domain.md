---
description: Rules for the domain layer
globs: ['src/domain/**/*.ts']
---

# Domain layer

Business logic lives here so it exists once and is testable without a browser, a server,
or a database.

- **No React, no Next.js, no component imports.** Enforced by ESLint
  (`no-restricted-imports` in `eslint.config.mjs`). Dependencies flow inward only.
- Functions take explicit inputs and return explicit outputs. Do not read global request
  state.
- Wedding configuration is read through `getWeddingSettings()` — never by importing the
  settings global directly (ADR-001).
- Validation schemas are shared with the client but **executed on the server**. Client
  validation is a convenience and is never authoritative.
- State machines (photo queue, RSVP/party status) expose valid transitions and reject
  invalid ones. The UI must not be able to produce an invalid state.
- Every rule added here needs a unit test in `tests/unit/` covering the boundary cases,
  not just the happy path.
