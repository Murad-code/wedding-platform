---
name: implement-phase
description: Implement the next incomplete task or phase from docs/IMPLEMENTATION_PLAN.md, following the project's understand → plan → implement → verify → review → document → record loop. Use when asked to continue the build, work the next phase, or pick up where the project left off.
---

# Implement the next phase

Work one coherent slice at a time. Do not attempt an entire phase in one enormous change
if it can be split into independently verifiable pieces.

## 1. Understand

- Read `docs/IMPLEMENTATION_PLAN.md` and find the first `[ ]` or `[~]` task.
- Read the sections of `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`,
  `docs/DATA_MODEL.md`, `docs/SECURITY.md`, and `docs/UX.md` that cover it.
- Inspect what already exists. Do not re-implement or duplicate it.

## 2. Plan

State briefly: desired behaviour, layers affected, data-model implications, security
implications, and how it will be tested. If the work contradicts an ADR, stop and raise
it rather than quietly diverging.

## 3. Implement

- Respect the dependency direction `app → components → domain → payload`.
- Business rules go in `src/domain/`, not in components or route handlers.
- Validate every mutation with Zod **on the server**.
- Handle loading, empty, error, and populated states for any data-driven view.
- No hardcoded client-specific content.
- Do not leave half-built abstractions behind.

## 4. Verify

Run the `verify` skill. For UI work, also check the running app visually and at a mobile
viewport. Investigate root causes; never disable a check or delete a test to go green.

## 5. Review

Re-read the diff for: dead code, duplication, accidental complexity, missing error and
empty states, missing tests, leaked tokens or PII, and missing server-side authorisation.

## 6. Document

Update `docs/` when behaviour or architecture changed. Add an ADR for a significant or
hard-to-reverse decision. Update `docs/DATA_MODEL.md` whenever a collection changes.

## 7. Record

Tick the task in `docs/IMPLEMENTATION_PLAN.md` **only if it was verified**. Use `[~]` for
genuinely partial work, and say plainly what remains.
