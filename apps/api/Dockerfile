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
      bun install --frozen-lockfile --production --filter @renovabit/api --network-concurrency 16 && break; \
      if [ "$i" -eq 3 ]; then exit 1; fi; \
      echo "bun install falló, reintentando ($i/3)..."; \
      sleep 5; \
    done

# Sources last: editing app code no longer invalidates the install layer.
COPY apps ./apps
COPY packages ./packages

FROM oven/bun:1.3.10-slim AS runner
WORKDIR /app

COPY --from=deps /app /app

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/apps/api
CMD ["bun", "run", "src/index.ts"]
