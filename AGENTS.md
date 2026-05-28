# AGENTS.md — RenovaBit

## Package manager

- **Use `bun`**, not npm / yarn / pnpm. Lockfile is `bun.lock`.
- Packages use Bun's `workspaces.catalog` for versioning. When adding a dep already in the catalog, use the `"catalog:"` protocol. New shared deps should be added to the root `package.json` catalog first.

## Monorepo structure (Turborepo + Bun workspaces)

```
apps/
  api/         → @renovabit/api       ElysiaJS backend (port 3001)
  admin/       → admin                TanStack Start + React SPA (port 3002, Vite 8)
  landing/     → landing              Astro static site (Preact islands)
packages/
  backend-client/  → @renovabit/backend-client   Eden Treaty typed client
  backend-errors/  → @renovabit/backend-errors   Error utils (nanoid, serialize-error)
  biome-config/    → @renovabit/biome-config     Shared Biome configs
  db/              → @renovabit/db               Drizzle ORM + Postgres schema
  ts-config/       → @renovabit/ts-config        Shared TS configs
  ui/              → @renovabit/ui               Shared React components (Base UI + Tailwind v4)
```

**Note:** `ecommerce` app is planned (in README) but does not exist yet.

## Key dev commands

```bash
bun run dev           # Start all apps in dev mode (turbo)
bun run build         # Build all apps and packages (turbo)
bun run check         # Biome check + write on all TS/JS/JSON/CSS files, then Prettier on Astro files
bun run check-types   # Type-check all packages (turbo)
bun run clean         # Remove .turbo caches and dist dirs

# Run a single workspace command
bun run --filter @renovabit/db db:generate
bun run --filter admin dev
```

### DB-specific (inside packages/db)

```bash
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Apply migrations
bun run db:push      # Push schema directly (dev only)
bun run db:studio    # Open Drizzle Studio GUI
```

## Code quality pipeline (enforced by Lefthook git hooks)

1. **pre-commit**: Biome formats staged `.js/.ts/.tsx/.json/.jsonc` files. Prettier formats staged `.astro` files.
2. **commit-msg**: commitlint validates conventional commit format.
3. **pre-push**: `biome check .` + `bun run check-types` (full workspace).

## Formatters — critical distinction

| File type        | Formatter |
|------------------|-----------|
| `.ts`, `.tsx`, `.js`, `.json`, `.jsonc`, `.css` | **Biome** |
| `.astro`         | **Prettier** (Biome does not support Astro) |

Do **not** install ESLint or use Prettier for anything except `.astro` files.

## TypeScript

- Version **6.0.3** (strict mode, `noUncheckedIndexedAccess: true`).
- Module resolution is `bundler`. Module is `ES2022`. Target is `ES2022`.
- The `apps/admin` package uses TanStack Router codegen. Before type-checking admin, run:
  ```bash
  bun run --filter admin generate   # produces routeTree.gen.ts
  ```
  `routeTree.gen.ts` is **gitignored** and excluded from Zed's file scan.

## Authentication (Better Auth)

- Defined in `apps/api/src/utils/auth/auth.ts`.
- Uses Drizzle adapter with PostgreSQL, `Bun.password.hash` for passwords.
- Cross-subdomain cookies enabled (domain: `renovabit.com` in prod, `localhost` in dev).
- Session: 7-day expiry, 1-day update age, stored in DB.
- User roles: `admin`, `customer`, `distributor`.
- Plugins: username, admin (impersonation, banning), OpenAPI.

## Docker & environment

### Local dev
```bash
docker compose -f docker-compose.dev.yaml up -d   # Starts only Postgres
```
Local dev runs the API and admin directly on the host (not in Docker). Only Postgres runs containerized.

### Required env files (gitignored)
- `.env.db` — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `.env.api` — `DATABASE_URL`, `BETTER_AUTH_SECRET`, `API_URL`, AWS S3 keys, etc.
- `.env.admin` — `VITE_API_URL`

## CI / Deploy

- Deploy triggers on push to `main` via GitHub Actions.
- **Self-hosted runner** (ARM64 Linux).
- Deploys to `/opt/docker/renovabit` on the VPS.
- Uses `docker compose` (production compose file) with Traefik reverse proxy.
- Automatic rollback via Docker image tags (`:prev`).
- Gotify notifications on success/failure.
- Requires `.env.api` and `.env.db` on the server.

## Commit conventions (see `.rules` and `commitlint.config.cjs`)

- Conventional commits: `type(scope): description`
- Allowed scopes: `api`, `landing`, `ecommerce`, `admin`, `ui`, `biome`, `ts`, `deps`, `ci`, `repo`
- Description must be lowercase, imperative mood, no period at end.
- Entire header must be ≤ 72 characters.
