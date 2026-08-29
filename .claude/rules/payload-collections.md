---
description: Conventions for Payload collections and globals
globs: ['src/collections/**/*.ts', 'src/globals/**/*.ts']
---

# Payload collections

Collections are the schema source of truth. A change here is a schema change.

- **Define `access` explicitly on every collection.** Default to deny. Never rely on a UI
  control being hidden — that is not access control. Public `read` is granted only where
  the guest site genuinely needs it, and only for the fields it needs.
- **Never add a `weddingId` or tenant field** (ADR-001). One deployment serves one wedding.
- Never expose `tokenHash` through `read` access, `defaultColumns`, or an API response.
- Use `index: true` on fields that filters and dashboard counts query — party, RSVP status,
  table, photo group order.
- Enforce invariants with database constraints (unique indexes) rather than hooks where
  possible; hooks do not survive concurrent writes.
- Put business rules in `src/domain/`, not in collection hooks. Hooks may _call_ domain
  functions; they should not _be_ the business logic.
- Field `admin.description` is user-facing help text — write it for a non-technical
  organiser, not for a developer.

After any change:

1. `pnpm generate:types`
2. Create a migration — do not rely on `push` outside development.
3. Update `docs/DATA_MODEL.md`, including the ER diagram if relationships changed.
