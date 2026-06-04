# STAGE 1: Pruner — extrae solo lo necesario del monorepo
FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .

RUN bunx turbo prune tienda --docker

# STAGE 2: Installer — instala dependencias
FROM oven/bun:1 AS installer
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/bun.lock ./bun.lock
RUN bun install

# STAGE 3: Builder — compila el admin (TanStack Start)
FROM oven/bun:1 AS builder
WORKDIR /app

COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .

# VITE_API_URL se incrusta en el bundle client-side en build time
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build de TanStack Start
WORKDIR /app/apps/tienda
RUN bun run build

# STAGE 4: Runner — bun necesario para servir el output
FROM oven/bun:1-slim AS runner
WORKDIR /app

COPY --from=builder /app/apps/tienda/.output ./.output
COPY --from=builder /app/apps/tienda/public ./public

# Server-side envs se leen en runtime con process.env
ENV NODE_ENV=production
ENV PORT=3003

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD bun run -e "const r = await fetch('http://localhost:3003/'); process.exit(r.ok ? 0 : 1)"

CMD ["bun", "run", "./.output/server/index.mjs"]
