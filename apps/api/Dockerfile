# STAGE 1: Pruner — extrae subset del monorepo
FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune @renovabit/api --docker

# STAGE 2: Installer — solo prod deps
# Usamos el bun.lock del build context (commiteado), no el del pruner.
# turbo prune regenera el lockfile y eso rompe `bun install --production`
# (bun lo ve como "cambio pendiente" y falla).
FROM oven/bun:1 AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY bun.lock ./bun.lock
RUN bun install --production

# STAGE 3: Runtime — Bun + código + prod deps
FROM oven/bun:1-slim AS runtime
WORKDIR /app

COPY --from=installer /app ./
COPY --from=pruner /app/out/full/ ./

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
