FROM oven/bun:1.3.10 AS deps
WORKDIR /app

# Manifests only first: `bun install` stays cached when app sources change,
# which is what made every deploy re-install dependencies on a 2-vCPU box.
COPY package.json bun.lock ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/api/package.json ./apps/api/
COPY apps/tienda/package.json ./apps/tienda/
COPY packages/backend-client/package.json ./packages/backend-client/
COPY packages/backend-errors/package.json ./packages/backend-errors/
COPY packages/biome-config/package.json ./packages/biome-config/
COPY packages/db/package.json ./packages/db/
COPY packages/pricing/package.json ./packages/pricing/
COPY packages/ts-config/package.json ./packages/ts-config/
COPY packages/ui/package.json ./packages/ui/

RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    set -eux; \
    for i in 1 2 3; do \
      bun install --frozen-lockfile --filter tienda --network-concurrency 16 && break; \
      if [ "$i" -eq 3 ]; then exit 1; fi; \
      echo "bun install falló, reintentando ($i/3)..."; \
      sleep 5; \
    done

# Sources last: editing app code no longer invalidates the install layer.
COPY apps ./apps
COPY packages ./packages

FROM oven/bun:1.3.10 AS builder
WORKDIR /app

COPY --from=deps /app /app

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

ARG VITE_SITE_URL
ENV VITE_SITE_URL=${VITE_SITE_URL}

WORKDIR /app/apps/tienda
RUN bun run build

FROM oven/bun:1.3.10-slim AS runner
WORKDIR /app

COPY --from=builder /app/apps/tienda/.output ./.output
COPY --from=builder /app/apps/tienda/public ./public

ENV NODE_ENV=production
ENV PORT=3003

EXPOSE 3003

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD bun -e "const r = await fetch('http://localhost:3003/robots.txt'); process.exit(r.ok ? 0 : 1)"

CMD ["bun", "run", "./.output/server/index.mjs"]
