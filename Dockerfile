# syntax=docker/dockerfile:1

# Production image for one client wedding (docs/CLIENT_DEPLOYMENT.md).
#
# Multi-stage so the shipped image contains the built application and its runtime
# dependencies only — no source, no dev dependencies, no package manager.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next traces the standalone bundle only when asked; the flag exists so a local
# `pnpm build` stays fast (see next.config.ts).
ENV NEXT_OUTPUT_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1

# Placeholders passed to the build command only, never as ENV: an ENV would persist in
# the image's metadata for anyone who runs `docker history`. Nothing here reaches the
# running container — the real values come from the environment at start-up, and the
# build never touches a database because every data-driven route is dynamic.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    PAYLOAD_SECRET=placeholder-used-only-to-satisfy-the-build-00 \
    pnpm build

# ---------------------------------------------------------------------------
# Migrations need the Payload CLI and the whole dependency tree, which the standalone
# runtime deliberately does not carry — the runtime image has five packages in
# `node_modules` and no `.bin` at all. This target exists to be run once per deploy and
# then exit; it is never a long-lived service.
FROM builder AS migrator
ENV NODE_ENV=production
CMD ["pnpm", "payload", "migrate"]

# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Runs as a non-root user. A container that is root inside is one container escape away
# from being root outside.
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migrations are an explicit deploy step, so the CLI and the config have to be present.
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
