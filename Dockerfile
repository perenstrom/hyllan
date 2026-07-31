# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# `next build` evaluates route handler modules (incl. src/db/client.ts)
# while collecting page data — a syntactically valid but unreachable URL is
# enough since the postgres.js driver only connects lazily (same as CI).
ENV DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not
# read at container startup — must come in as a build arg, not a runtime
# `environment:` entry (see compose.yaml's app.build.args).
ARG NEXT_PUBLIC_GLITCHTIP_DSN
ENV NEXT_PUBLIC_GLITCHTIP_DSN=$NEXT_PUBLIC_GLITCHTIP_DSN
# next.config.ts's rewrites() reads this at build time to validate the
# /auth/v1/* destination — without it, the destination template literal
# resolves to "undefined/:path*" and `next build` fails with "Invalid
# rewrite found". CI's build step never caught this because it runs
# `npm run build` directly on the runner (with the var set as a plain env
# var), not through this Dockerfile.
ARG GOTRUE_API_EXTERNAL_URL
ENV GOTRUE_API_EXTERNAL_URL=$GOTRUE_API_EXTERNAL_URL
RUN npm run build

# Coolify's one-shot migrate service runs `npm run db:migrate` against this
# stage rather than the runner below: drizzle-kit is a devDependency, and
# Next's standalone output (copied into runner) only traces production
# dependencies actually imported by the server, so drizzle-kit never makes it
# in. `deps`'s node_modules still has it, since npm ci here installs
# devDependencies too.
FROM deps AS migrator
WORKDIR /app
COPY . .
CMD ["npm", "run", "db:migrate"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# No top-level public/ directory exists yet — add
# `COPY --from=builder /app/public ./public` here if one is introduced;
# standalone output does not copy it automatically.

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
