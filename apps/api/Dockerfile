# STAGE 1: Pruner — extrae solo lo necesario del monorepo
FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .

RUN bunx turbo prune @renovabit/api --docker

# STAGE 2: Installer — instala dependencias
FROM oven/bun:1 AS installer
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/bun.lock ./bun.lock
RUN bun install

# STAGE 3: Builder — compila la API
FROM oven/bun:1 AS builder
WORKDIR /app

COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .

WORKDIR /app/apps/api

ENV NODE_ENV=production

# Compilar a binario estático (Bun standalone)
RUN bun build ./src/index.ts \
    --compile \
    --minify \
    --sourcemap \
    --outfile server

# STAGE 4: Runner — imagen mínima
# El binario es standalone, no necesita Bun en runtime
FROM gcr.io/distroless/base-debian12:nonroot AS runner
WORKDIR /app

COPY --from=builder /app/apps/api/server ./server
COPY --from=builder /app/apps/api/public ./public

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

ENTRYPOINT ["./server"]
