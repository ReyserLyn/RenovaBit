FROM oven/bun:1.3.10 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages

RUN set -eux; \
    for i in 1 2 3; do \
      bun install --frozen-lockfile --production --filter @renovabit/api --network-concurrency 16 && break; \
      if [ "$i" -eq 3 ]; then exit 1; fi; \
      echo "bun install falló, reintentando ($i/3)..."; \
      sleep 5; \
    done

FROM oven/bun:1.3.10-slim AS runner
WORKDIR /app

COPY --from=deps /app /app

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/apps/api
CMD ["bun", "run", "src/index.ts"]
