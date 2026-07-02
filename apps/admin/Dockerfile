FROM oven/bun:1.3.10 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages

RUN set -eux; \
    for i in 1 2 3; do \
      bun install --frozen-lockfile --filter admin --network-concurrency 16 && break; \
      if [ "$i" -eq 3 ]; then exit 1; fi; \
      echo "bun install falló, reintentando ($i/3)..."; \
      sleep 5; \
    done

FROM oven/bun:1.3.10 AS builder
WORKDIR /app

COPY --from=deps /app /app

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /app/apps/admin
RUN bun run build

FROM oven/bun:1.3.10-slim AS runner
WORKDIR /app

COPY --from=builder /app/apps/admin/.output ./.output
COPY --from=builder /app/apps/admin/public ./public

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD bun run -e "const r = await fetch('http://localhost:3002/'); process.exit(r.ok ? 0 : 1)"

CMD ["bun", "run", "./.output/server/index.mjs"]
