# AGENTS.md — RenovaBit

## Package manager

- **Use `bun`**, not npm / yarn / pnpm. Lockfile is `bun.lock`. Pinned via `packageManager: "bun@1.3.10"` in the root `package.json`.
- Packages use Bun's `workspaces.catalog` for versioning. When adding a dep already in the catalog, use the `"catalog:"` protocol. New shared deps should be added to the root `package.json` catalog first.

## Monorepo structure (Turborepo + Bun workspaces)

```
apps/
  api/         → @renovabit/api       ElysiaJS backend, port 3001
  admin/       → admin                TanStack Start (Nitro/Bun, Vite 8), port 3002
  tienda/      → tienda               TanStack Start storefront (Nitro/Bun, Vite 8), port 3003. E-commerce app.
  landing/     → landing              Astro 6 static site, port 3000
packages/
  backend-client/  → @renovabit/backend-client   Eden Treaty typed client (consumes `App` from api)
  backend-errors/  → @renovabit/backend-errors   Error utils (nanoid, serialize-error)
  biome-config/    → @renovabit/biome-config     Shared Biome configs
  db/              → @renovabit/db               Drizzle ORM + Postgres schema; `casing: "snake_case"`
  ts-config/       → @renovabit/ts-config        Shared TS configs (base / nextjs / react-library)
  ui/              → @renovabit/ui               Shared React components (Base UI + Tailwind v4)
```

**Naming caveat:** the e-commerce app is folder-named `tienda` (Spanish for "store"), not `ecommerce`. Routes and feature folders inside `apps/tienda/` and `apps/admin/src/` are also in Spanish (e.g. `pedidos.tsx`, `carrito.tsx`, `marcas.tsx`).

## Key dev commands

```bash
bun run dev           # turbo: start all apps in dev mode
bun run build         # turbo: build all apps and packages
bun run check         # biome check --write (whole repo) + prettier on landing astro files
bun run check:biome   # biome only, no prettier
bun run check-types   # turbo: type-check all packages
bun run clean         # remove .turbo + dist dirs (preserves docker-volumes)

# Run a single workspace
bun run --filter admin dev
bun run --filter tienda dev
bun run --filter landing dev
bun run --filter @renovabit/api dev
```

**Ports used in dev:** landing 3000, api 3001, admin 3002, tienda 3003. CORS / auth trustedOrigins read `LANDING_URL`, `API_URL`, `ADMIN_URL`, `STORE_URL` from env (see `apps/api/src/utils/origins.ts`).

### DB-specific (run from repo root or via `--filter`)

```bash
bun run --filter @renovabit/db db:generate   # drizzle-kit generate
bun run --filter @renovabit/db db:migrate    # apply migrations
bun run --filter @renovabit/db db:push       # push schema directly (dev only)
bun run --filter @renovabit/db db:studio     # open Drizzle Studio
```

Generated SQL migrations live in `packages/db/drizzle/` and are committed.

## Code quality pipeline (enforced by Lefthook git hooks)

1. **pre-commit** (parallel): Biome formats staged `.js/.ts/.tsx/.json/.jsonc`; Prettier formats staged `.astro` (stage-fixed).
2. **commit-msg**: commitlint validates conventional commit format.
3. **pre-push** (parallel): `biome check .` + `bun run check-types` (full workspace).

## Formatters — critical distinction

| File type        | Formatter |
|------------------|-----------|
| `.ts`, `.tsx`, `.js`, `.json`, `.jsonc`, `.css` | **Biome** |
| `.astro`         | **Prettier** (Biome does not support Astro) |

Indent is **tabs** (Biome `indentStyle: "tab"`, Prettier `useTabs: true`), line width 100. Do **not** install ESLint or run Prettier on non-`.astro` files.

## TypeScript

- **6.0.3**, strict, `noUncheckedIndexedAccess: true`. Module/target `ES2022`, resolution `bundler`. Configs via `@renovabit/ts-config/{base,nextjs,react-library}`.
- `apps/admin` and `apps/tienda` use TanStack Router **file-based codegen** (`bunx @tanstack/router-cli generate`). The generated `src/routeTree.gen.ts` is **gitignored** and auto-run by their `check-types` script — only invoke `bun run generate` manually when adding/moving route files.
- `apps/api/src/index.ts` ends with `export type App = typeof app;` — this is the contract that `@renovabit/backend-client` consumes via Eden Treaty. Do not remove it.

## Authentication (Better Auth)

- Configured in `apps/api/src/utils/auth/auth.ts` (mounted at `basePath: "/api/v1/auth"`). The `auth` instance is re-exported as `@renovabit/api/auth`.
- Adapter: Drizzle (PostgreSQL). `Bun.password.hash`/`verify` for password hashing.
- **Secondary storage: Redis** (via `@better-auth/redis-storage`) — also powers rate-limit counters. Redis client lives at `apps/api/src/utils/redis/index.ts`.
- Cookie: `renovabit` prefix, cross-subdomain (`.renovabit.com` in prod, `localhost` in dev). Session: 7-day expiry, 1-day update age, persisted in DB with 1h compact cookie cache.
- User roles: `admin`, `customer`, `distributor` (with `admin` as the only `adminRoles`).
- Plugins: `username` (reserved names list in `auth.ts`), `admin` (impersonation 15 min, ban 7-day default), `openAPI`. OpenAPI docs exposed at `/docs` in dev only (`apps/api/src/plugins/docs.ts`).
- CORS trusted origins are built from `LANDING_URL` + `API_URL` + `ADMIN_URL` + `STORE_URL` env vars.

## Other infrastructure

- **Storage:** Cloudflare R2 (S3-compatible). Env keys `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`. Used by `apps/api/src/modules/storage/`.
- **Background jobs:** BullMQ + Redis. Queues in `apps/api/src/jobs/` (`orders.queue.ts`, `scraping.queue.ts`); workers auto-imported via `apps/api/src/jobs/index.ts`. **Bull-Board UI** mounted at `GET /admin/queues` — admin-only (returns 403 for non-admins, see `apps/api/src/plugins/bull-board.ts`).
- **Logging:** `loglayer` with `simple-pretty-terminal` transport (`apps/api/src/utils/logger.ts`).

## Docker & environment

### Local dev
```bash
docker compose -f docker-compose.dev.yaml up -d   # Starts Postgres + Redis
```
API and the three web apps run on the host (not in Docker). Only Postgres + Redis are containerized. The `apps/api` container block in `docker-compose.dev.yaml` is commented out — keep it that way for dev.

### Required env files (all gitignored)
- Root `.env` — local host URLs + secrets (template; values are local-only).
- `.env.db` — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (for the Postgres container).
- `.env.redis` — `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`.
- `apps/api/.env` — full API env (DATABASE_URL, BETTER_AUTH_SECRET, R2 keys, Google OAuth, OpenRouter, etc.).
- `apps/tienda/.env` — `VITE_API_URL`, `VITE_SITE_URL`.
- Admin reads `VITE_API_URL` / `VITE_SITE_URL` from its own `.env` (not present in this checkout — copy from root `.env`).

## CI / Deploy

- `.github/workflows/deploy-vps.yaml` runs on push to `main` against a **self-hosted ARM64 runner**.
- Deploys to `/opt/docker/renovabit` on the VPS via `docker compose build && up -d`. Uses the production `docker-compose.yaml` (Traefik reverse proxy, no Redis service — DB-only there).
- **Auto-rollback** via Docker tag `:prev`: each successful build tags the current `:latest` as `:prev`; on failure, `:prev` is retagged to `:latest` and `up -d` re-runs.
- Health-checks: `renovabit-postgres` (pg_isready), `renovabit-api` (none in compose, port-checked in workflow), `renovabit-admin` (HTTP `/`). Required server files: `.env.api`, `.env.db`. Gotify notifications on success/failure.
- Each app Dockerfile uses `bunx turbo prune <workspace> --docker` to build a minimal monorepo slice; the API is `bun build --compile --minify` into a single static binary running on `distroless/base-debian12:nonroot`.

## Commit conventions (see `.rules` and `commitlint.config.cjs`)

- Conventional commits: `type(scope): description`.
- Allowed scopes: `api`, `landing`, `ecommerce`, `admin`, `ui`, `biome`, `ts`, `deps`, `ci`, `repo`. (`ecommerce` is the **commit scope** — not a folder name; the folder is `tienda`.)
- Description must be lowercase, imperative mood, no trailing period.
- Entire header `type(scope): description` ≤ 72 chars; aim for ~45–50 chars in the description.
