---
name: verify
description: Run the project verification pipeline — format, lint, typecheck, unit tests, E2E where relevant, and production build — and report failures clearly. Use before marking work complete, before committing, or when asked to check that the project is healthy.
---

# Verify

Run checks cheapest-first so failures surface fast.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run E2E when the change touches routing, RSVP, authentication, or a user journey — and
always before declaring a phase complete:

```bash
pnpm test:e2e
```

Playwright needs Postgres running (`pnpm db:up`) and a built or dev app.

## Reporting

For each failure, report: the check, the file and line, the actual error, and whether it
was caused by the current work.

- **Caused by current work** → fix the root cause.
- **Pre-existing** → report it; fix only if it blocks, and say so.

Never silence a failure to make the pipeline pass — no skipped tests, no disabled rules,
no `any` inserted to defeat the typechecker, no `--force`. If a check is genuinely wrong,
change it deliberately and explain why in the commit.

Report honestly: if a check did not run, say it did not run rather than implying it passed.
