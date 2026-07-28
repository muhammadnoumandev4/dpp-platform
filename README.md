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

```bash
git clone https://github.com/muhammadnoumandev4/dpp-platform.git
cd dpp-platform
JWT_SECRET=$(openssl rand -base64 48) docker compose up --build
```

Wait until `api` and `web` are healthy, then open:

| What | URL |
|---|---|
| Back office + public passports | http://localhost:3001 |
| API | http://localhost:3000 |
| Swagger / OpenAPI | http://localhost:3000/api/docs |
| Login | http://localhost:3001/login |
| Brand signup | http://localhost:3001/signup |

On first boot Compose starts Postgres + Redis + API + Web, applies Prisma migrations, and runs the
idempotent seed (`RUN_SEED=true` by default). After a successful first seed on a persistent volume,
you can set `RUN_SEED=false` for later restarts.

Stop with `Ctrl+C`, or `docker compose down`. Data volumes persist; wipe with
`docker compose down -v`.

---

## Demo accounts

Password for both: **`password123`**

| Email | Role | Opens |
|---|---|---|
| `editor@notarify.test` | Brand **OWNER** (Notarify) | http://localhost:3001/ |
| `admin@notarify.test` | Platform **ADMIN** | http://localhost:3001/admin |

Both use the same login form; the app routes by role after sign-in. Despite the email prefix,
`editor@notarify.test` is the brand **owner**, not an `EDITOR`-role user.

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
# Set DATABASE_URL to postgresql://dpp:dpp@localhost:5433/dpp
# Set JWT_SECRET to a string ≥ 32 characters
npm install
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

**Web** (separate terminal):

```bash
cd web
cp .env.example .env   # NEXT_PUBLIC_API_URL=http://localhost:3000
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
