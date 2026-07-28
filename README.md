# Digital Product Passport (DPP) Platform

A full-stack Digital Product Passport platform. Brands manage product identity, materials,
sustainability data, certifications, documents and images, then publish an immutable,
UUID-addressed passport linked by a QR code. Public passport visits are recorded and feed the
dashboard and analytics.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system design, design decisions, security
approach, scalability considerations and future improvements, and
[docs/DATA-MODEL.md](./docs/DATA-MODEL.md) for the database schema and its integrity invariants.

## Stack

| Layer | Technology |
|---|---|
| API | Node.js 20, NestJS 11, PostgreSQL, Prisma ORM, JWT (httpOnly cookie), Swagger/OpenAPI |
| Web | Next.js 14 (App Router), React 18, TypeScript, Material UI |
| Infra | Docker Compose (Postgres + Redis + API + Web), Redis cache with in-memory fallback, non-root containers |

JWT secret and seed behaviour are overridable via Compose env:

```bash
JWT_SECRET=$(openssl rand -base64 48) RUN_SEED=true docker compose up --build
```

After the first successful seed against a persistent volume, set `RUN_SEED=false`.

## Installation and execution

### Prerequisites

- Docker and Docker Compose (for the one-command stack), or
- Node.js 20+, npm and a local Docker for Postgres (for local development)

### Quick start (Docker Compose)

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Back office + public passports | http://localhost:3001 |
| API | http://localhost:3000 |
| Swagger / OpenAPI docs | http://localhost:3000/api/docs |

The API entrypoint applies pending Prisma migrations on start and, while `RUN_SEED=true`
(the Compose default), runs the idempotent seed **on every container start**. Turn the flag off
after initial setup in any persistent, non-demo environment.

### Seed accounts (password: `password123`)

| Email | Role | Lands on |
|---|---|---|
| `editor@notarify.test` | `OWNER` of the seeded Notarify brand | `/` (back office) |
| `admin@notarify.test` | `ADMIN` (internal platform employee) | `/admin` (platform console) |

Both sign in through the same form at http://localhost:3001/login; the web app routes by role
after login. Note that despite its email address, `editor@notarify.test` is the brand **owner**
account, not an `EDITOR`-role user.

The seeded product has materials and sustainability data but no cover image, so publishing it
as-is is blocked by the publish validation — upload a cover image first.

New brands can self-register at http://localhost:3001/signup. Registration atomically creates the
organisation and its brand-owner (`OWNER`) account, signs the owner in, and records the event in
the audit log. Every brand manages only its own products, passports, users and analytics.

### Local development (without Compose for the apps)

```bash
docker compose up -d postgres

cd api
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

```bash
# Separate terminal
cd web
cp .env.example .env
npm install
npm run dev
```

Compose maps Postgres to host port `5433`; keep the local API `DATABASE_URL` aligned with it.
Redis is optional in local development — the cache falls back to an in-memory store when
`REDIS_URL` is unset.

## Roles and permissions

All identities live in the single `users` table, distinguished by the `Role` enum. `ADMIN` is the
only role with no `organisationId`; the other three are tenant roles scoped to one organisation.
Route access is checked per-endpoint against the permission set for the role
(`api/src/auth/permissions.ts`), not against the role name.

| Role | Permissions | Access |
|---|---|---|
| `ADMIN` | `platform.read`, `platform.manage`, `brands.manage` | Internal platform employee. Cross-tenant console: platform totals, every brand, passports, scans, audit history, brand suspension/reactivation. Holds no tenant permissions (`users.manage` is tenant-only), so tenant product and brand routes reject it. |
| `OWNER` | `brand.*`, `products.*`, `users.manage` | Created automatically by brand signup. Full brand profile, team, audit log, product and passport control, including archiving (soft delete). |
| `MANAGER` | `brand.read`, `products.read/create/update/publish` | Invited by the owner. Manages products and may publish and unpublish them. Cannot archive products (no `products.delete`), manage the brand profile, or manage the team. |
| `EDITOR` | `brand.read`, `products.read/create/update` | Invited by the owner. Creates and edits product content, uploads and previews, but cannot publish, unpublish, archive, manage users or change brand settings. |

Owners can invite only Managers or Editors — the invitation DTO restricts the role and a database
CHECK constraint backstops it, so neither ownership nor platform admin can be granted through an
invitation. Ownership cannot be removed through the Users screen.

## Modules

```text
api/src/
├── auth/           brand registration, cookie/Bearer JWT authentication and permission guards
├── platform-admin/ cross-tenant employee console and global brand operations
├── organisations/  brand profile and tenant-scoped updates
├── invitations/    tenant invitations and race-safe acceptance
├── users/          tenant member list and account deactivation
├── taxonomy/       curated category, country and material catalogs
├── products/       drafts, nested resources and publish validation
├── passports/      publish status, immutable versions and public reads
├── uploads/        storage abstraction, magic-byte validation and orphan cleanup
├── qr/             stable public QR generation
├── scans/          privacy-aware scan recording and deduplication
├── analytics/      dashboard totals, trends and daily series
├── audit/          tenant-scoped mutation history
├── cache/          Redis cache with in-memory fallback
└── common/         validation, errors, request IDs and logging

web/
├── app/login + app/signup   shared authentication and brand onboarding
├── app/admin/               internal platform operations console (role-routed after login)
├── app/(dashboard)/         dashboard, products, passports, analytics, users, settings
├── app/invite/[token]/      invitation acceptance
├── app/passport/[uuid]/     public passport page
└── components/passport/     shared PassportView used by the editor preview and the public page
```

## Publication contract

`Product` is the mutable draft. `PassportVersion` is an immutable JSON snapshot. First publication
creates version 1 and a stable UUID/QR. Later edits set `hasUnpublishedChanges`, but the public
page continues serving the last snapshot until republish. Republishing increments the version
without changing the UUID. Soft-deleting archives the mutable product from the back office but
preserves its last issued immutable passport; public access is withdrawn only through the explicit
Unpublish action.

The publish transaction locks the product and passport rows, revalidates the locked product graph,
stores the snapshot, advances the version and updates product state atomically. Authenticated
tenant users can inspect the append-only history through `GET /products/:id/passport-versions`.

## Verification

```bash
npm --prefix api run build
npm --prefix api test -- --runInBand
npm --prefix web run lint
npm --prefix web run build

# Run after the seeded API is available:
npm --prefix api run test:integration

# Optional live-DB integrity probes; every write is rolled back:
set -a; source api/.env; set +a
psql "$DATABASE_URL" -f scripts/db-integrity-smoke.sql
```

The unit suite contains **51 tests across 16 suites**, all passing. Scan recording reads the
client IP from Express's trusted-proxy-aware `request.ip` (configured via `TRUST_PROXY`), so
client-supplied forwarding headers cannot spoof the scan IP hash or country.

`npm test` runs only the unit suites under `api/src` (Jest `rootDir` is `src`). Black-box coverage
lives in `scripts/integration-smoke.mjs` and runs separately against a live seeded stack;
`api/test/products.e2e-spec.ts` is a small Prisma-backed e2e file invoked by `test:e2e`.

The integration script covers isolated employee/brand sessions and cross-role denial, ranked
product search and filters, product completion, publish v1, PDF export, draft/public immutability,
republish v2 with a stable UUID, audit-log creation, forged-upload rejection, soft-delete passport
preservation and explicit public withdrawal. The rolled-back SQL smoke test proves the
cross-tenant taxonomy/publisher foreign keys, single-owner rule, assignable invitation roles and
passport version-state checks at the PostgreSQL level.

## Bonus features

All bonus items named in the assessment are implemented: PostgreSQL full-text product search,
passport versioning, soft delete, owner-visible audit log, Redis caching, pagination and advanced
filters, server-generated passport PDF export, native drag-and-drop uploads with client and server
validation, and automated unit/integration tests. Redis supports URL or split/TLS configuration
and uses a `dpp:` key namespace by default so a managed instance can be shared safely.
