# Digital Product Passport (DPP) Platform

Full-stack Digital Product Passport platform for the technical assessment.

Brands create and manage product drafts (materials, sustainability, certifications, documents,
images), publish an immutable passport with a stable UUID/QR, and review scan analytics. End users
open the public passport without logging in.

This README is the single entry point for **install, run, demo accounts, URLs, API docs, and
verification**. Longer design notes live in [ARCHITECTURE.md](./ARCHITECTURE.md) and
[docs/DATA-MODEL.md](./docs/DATA-MODEL.md).

---

## Quick start (recommended)

**Prerequisite:** Docker Desktop (or Docker Engine + Compose v2).

The professional way is to put secrets in a root `.env` file (Compose loads it automatically),
then start the stack:

```bash
git clone https://github.com/muhammadnoumandev4/dpp-platform.git
cd dpp-platform
cp .env.example .env
# Generate a secret (≥32 chars) and paste it as JWT_SECRET in `.env`:
openssl rand -base64 48
# edit .env → JWT_SECRET=<paste>
docker compose up --build
```

`RUN_SEED=true` in `.env` seeds demo users on API start (safe default for review).

Wait until `api` and `web` are healthy, then open:

| What | URL |
|---|---|
| Back office + public passports | http://localhost:3001 |
| API | http://localhost:3000 |
| Swagger / OpenAPI | http://localhost:3000/api/docs |
| Login | http://localhost:3001/login |
| Brand signup | http://localhost:3001/signup |

On first boot Compose starts Postgres + Redis + API + Web, applies Prisma migrations, and runs the
idempotent seed when `RUN_SEED=true`. After a successful first seed on a persistent volume, set
`RUN_SEED=false` in `.env` for later restarts.

Stop with `Ctrl+C`, or `docker compose down`. Data volumes persist; wipe with
`docker compose down -v`.

---

## Environment variables

Examples are committed; real secret files are gitignored.

| File | Used for | Copy to |
|---|---|---|
| [`.env.example`](./.env.example) | Docker Compose (`JWT_SECRET`, `RUN_SEED`) | repo-root `.env` |
| [`api/.env.example`](./api/.env.example) | Local NestJS (`npm run start:dev`) | `api/.env` |
| [`web/.env.local.example`](./web/.env.local.example) | Local Next.js (`npm run dev`) | `web/.env.local` |

### Root `.env` (Docker Compose) — required to run via Compose

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | **Yes** (≥32 chars) | Signs auth cookies/tokens. Generate with `openssl rand -base64 48`. |
| `RUN_SEED` | No (default `true`) | Run Prisma seed on API container start. |

Compose already wires DB/Redis/URLs inside `docker-compose.yml` for the containers. You normally
only set the two variables above in the root `.env`.

### Backend `api/.env` — local API without full Compose app containers

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | Postgres connection. With Compose Postgres: `postgresql://dpp:dpp@localhost:5433/dpp` |
| `JWT_SECRET` | **Yes** (≥32 chars) | Same as above |
| `PORT` | No | API port (default `3000`) |
| `UPLOAD_DIR` | No | Local upload directory (default `./uploads`) |
| `PUBLIC_BASE_URL` | No | Public API base (QR/PDF links) |
| `WEB_PUBLIC_URL` | No | Web app origin |
| `CORS_ORIGIN` | No | Allowed browser origin |
| `COOKIE_SECURE` | No | `true` only behind HTTPS |
| `TRUST_PROXY` | No | Set when behind a trusted reverse proxy |
| `SCAN_COUNTRY_FALLBACK` | No | Fallback country code for scans |
| `SCAN_IP_PEPPER` | No | Optional HMAC pepper (else `JWT_SECRET`) |
| `REDIS_URL` | No | Redis URL; empty → in-memory cache |
| `REDIS_KEY_PREFIX` | No | Key namespace (default `dpp:`) |
| `CACHE_MAX_MEMORY_ENTRIES` | No | In-memory cache cap |

### Frontend `web/.env.local` — local Next.js

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | **Yes** (for browser) | API origin seen by the browser (`http://localhost:3000`) |
| `INTERNAL_API_URL` | No | SSR server-side fetch origin. In Docker Compose this is `http://api:3000`; for local `next dev` leave unset or same as `NEXT_PUBLIC_API_URL`. |

Docker Compose sets web env for you (`NEXT_PUBLIC_API_URL`, `INTERNAL_API_URL`) — you do **not**
need `web/.env.local` when running only via `docker compose up --build`.

---

## Demo accounts

Password for **all** seed users: **`password123`**

| Email | Role | Opens / purpose |
|---|---|---|
| `editor@notarify.test` | Brand **OWNER** (Notarify) | http://localhost:3001/ — full brand back office |
| `manager@notarify.test` | **MANAGER** | Publish allowed; no team/archive/settings |
| `member@notarify.test` | **EDITOR** | Edit drafts only; cannot publish |
| `admin@notarify.test` | Platform **ADMIN** | http://localhost:3001/admin |
| `atlas.owner@atlas.test` | **OWNER** (Atlas Goods) | Second brand for multi-tenant / admin tests |

Both brand and admin use the same login form; the app routes by role after sign-in. Despite the
email prefix, `editor@notarify.test` is the brand **owner**, not an `EDITOR`-role user.

### Seeded products (Notarify) — what to click

| SKU | State | What to test |
|---|---|---|
| `NTF-4192-BLK` | Incomplete draft (no cover) | Publish blockers |
| `NTF-READY-001` | Complete draft + cover/certs/docs | Click **Publish** |
| `NTF-LIVE-100` | Published + QR + scans + unit items + 2 versions | Passport, analytics, inventory, version history |
| `NTF-OFF-300` | Unpublished | Public URL withdrawn |
| `NTF-ARCH-200` | Soft-deleted | Archive behaviour |
| `NTF-EMPTY-400` | Minimal draft | Edit flows |

Atlas Goods also has a published `ATL-PARKA-01` for the platform admin console.

After seed, the API log prints the live public passport URL for `NTF-LIVE-100`.

A pending invitation exists for `invitee@notarify.test` (Users → invitations).

---

## 5-minute smoke path (reviewer checklist)

1. Login as `editor@notarify.test` / `password123`.
2. Open **Products** → open the seeded product (or create a new draft).
3. **Images** tab → upload a **cover** image (seeded product cannot publish without one).
4. Click **Publish** → confirm QR + public URL are generated.
5. Open the passport (`Open Passport` or `/passport/{uuid}`) — preferably with `?src=qr`.
6. Check **Dashboard** and **Analytics** for views/scans.
7. Open Swagger at http://localhost:3000/api/docs and try `GET /dashboard` after authenticating
   via login cookie / Bearer as documented in the UI.

Optional: platform console with `admin@notarify.test` at `/admin`.

---

## Deliverables map

| Assessment ask | Location in this repo |
|---|---|
| Complete source (backend + frontend) | `api/`, `web/` |
| Docker Compose | `docker-compose.yml` (+ `api/Dockerfile`, `web/Dockerfile`) |
| Migrations + seed | `api/prisma/migrations/`, `api/prisma/seed.ts` |
| Swagger / OpenAPI | http://localhost:3000/api/docs (NestJS Swagger from DTOs) |
| README (install + run) | this file |
| Architecture (2–3 pages) | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Database design detail | [docs/DATA-MODEL.md](./docs/DATA-MODEL.md) + `api/prisma/schema.prisma` |

---

## Stack

| Layer | Technology |
|---|---|
| API | Node.js 20, NestJS 11, PostgreSQL, Prisma, JWT (httpOnly cookie), Swagger/OpenAPI |
| Web | Next.js 14 (App Router), React 18, TypeScript, Material UI |
| Infra | Docker Compose (Postgres, Redis, API, Web), Redis cache with in-memory fallback, non-root containers |

---

## Local development (apps outside Compose)

Use this only if you want hot-reload without rebuilding images. Postgres can still run via Compose.

**API** (Postgres on host port **5433** when using Compose):

```bash
docker compose up -d postgres redis

cd api
cp .env.example .env
# Set JWT_SECRET in api/.env (≥32 chars): openssl rand -base64 48
npm install
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

**Web** (separate terminal):

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev            # http://localhost:3001
```

Redis is optional locally — if `REDIS_URL` is unset the API uses an in-memory cache fallback.

---

## Required API surface

Implemented and documented in Swagger:

| Method | Path |
|---|---|
| `POST` | `/auth/login` |
| `GET` | `/products` |
| `POST` | `/products` |
| `PATCH` | `/products/{id}` |
| `DELETE` | `/products/{id}` |
| `POST` | `/products/{id}/publish` |
| `GET` | `/passport/{uuid}` |
| `GET` | `/analytics` |
| `GET` | `/dashboard` |

Additional routes (versions, unpublish, scans beacon, uploads, users, etc.) are listed in Swagger.

---

## Roles and permissions

All identities live in `users`. `ADMIN` has `organisationId = null`; brand roles are tenant-scoped.
Endpoints declare permissions (`api/src/auth/permissions.ts`); access is not a raw role string check.

| Role | Access |
|---|---|
| `ADMIN` | Platform console only (cross-tenant). No brand product routes. |
| `OWNER` | Full brand: products, publish, users, settings, soft-delete. |
| `MANAGER` | Products + publish/unpublish; no team/archive/settings. |
| `EDITOR` | Create/edit drafts and uploads; cannot publish. |

Owners invite only Manager or Editor (DTO + DB CHECK). New brands self-register at `/signup`
(creates organisation + OWNER atomically).

---

## Publication model (important)

- **`Product`** = mutable draft.
- **`PassportVersion`** = immutable JSON snapshot served to the public.
- First publish creates version `1` and a **stable** UUID/QR (never changes on republish).
- Draft edits after publish do **not** change the public page until republish.
- Soft-delete archives the product in the back office but keeps the last passport; **Unpublish**
  withdraws public access.

Preview in the product editor defaults to the **published snapshot** (what consumers see), with an
option to inspect the current draft.

---

## Project layout

```text
api/src/
├── auth/  platform-admin/  organisations/  invitations/  users/
├── taxonomy/  products/  passports/  uploads/  qr/
├── scans/  analytics/  audit/  cache/  health/  common/
web/
├── app/(dashboard)/   brand back office
├── app/admin/         platform console
├── app/passport/      public SSR passport
└── components/passport/  shared PassportView (preview + public)
```

---

## Verification

With Node 20+ installed (Compose stack can be stopped or left running for e2e):

```bash
npm --prefix api test -- --runInBand
npm --prefix api run build
npm --prefix web run lint
npx --prefix web tsc --noEmit
npm --prefix web run build
```

Optional Playwright (needs running web+api): `npm --prefix web run test:e2e`.

---

## Bonus features included

Full-text product search, passport versioning, soft delete, audit log, Redis caching, pagination /
filters, passport PDF export, drag-and-drop uploads with server magic-byte checks, unit tests, CI
(`.github/workflows/ci.yml`).

---

## Architecture docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design, decisions, security, scalability, future work
- [docs/DATA-MODEL.md](./docs/DATA-MODEL.md) — schema, tenancy invariants, integrity notes
