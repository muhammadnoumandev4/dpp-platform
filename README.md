# Digital Product Passport (DPP) Platform

Full-stack Digital Product Passport platform for the technical assessment.

Brands create and manage product drafts (materials, sustainability, certifications, documents,
images), publish an immutable passport with a stable UUID/QR, and review scan analytics. End users
open the public passport without logging in.

This README is the single entry point for **install, run, demo accounts, URLs, API docs, and
verification**. For a step-by-step reviewer checklist, use **[TESTING.md](./TESTING.md)**.
Longer design notes live in [ARCHITECTURE.md](./ARCHITECTURE.md) and
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

### Platform admin
| Email | Opens |
|---|---|
| `admin@notarify.test` | http://localhost:3001/admin — all brands, scans, suspend/reactivate |

### Brands (each has OWNER + MANAGER + EDITOR)

| Brand | OWNER | MANAGER | EDITOR | Notes |
|---|---|---|---|---|
| **Notarify** | `editor@notarify.test` | `manager@notarify.test` | `member@notarify.test` | Primary demo brand |
| **Atlas Goods** | `owner@atlasgoods.test` | `manager@atlasgoods.test` | `editor@atlasgoods.test` | Outdoor |
| **Lumina Home** | `owner@luminahome.test` | `manager@luminahome.test` | `editor@luminahome.test` | Home |
| **Verde Beauty** | `owner@verdebeauty.test` | `manager@verdebeauty.test` | `editor@verdebeauty.test` | Beauty |
| **Harbor Labs** | `owner@harborlabs.test` | `manager@harborlabs.test` | `editor@harborlabs.test` | **Suspended** — test reactivate in admin |

Extra Manager/Editor accounts also exist as `{atl|lum|vrd|hbr}.manager@demo.test` /
`{atl|lum|vrd|hbr}.editor@demo.test`. Alias `atlas.owner@atlas.test` is an Atlas **MANAGER**
(each brand can have only one OWNER).

### Per-brand product states (MVP coverage)

Every brand is seeded with the same workflow set (SKU prefix `NTF` / `ATL` / `LUM` / `VRD` / `HBR`):

| State | Example (Notarify) | What to test |
|---|---|---|
| Incomplete draft | `NTF-4192-BLK` | Publish blockers (no cover) |
| Ready to publish | `NTF-READY-001` | Click **Publish** |
| Live + analytics | `NTF-LIVE-100`, `*-LIVE-200` | Passport, QR, scans, inventory, versions |
| Unpublished | `*-OFF-300` | Public URL withdrawn |
| Soft-deleted | `*-ARCH-200` | Archive behaviour |
| Minimal draft | `*-EMPTY-400` | Edit flows |

Plus a **seeded Activity timeline** per brand (create/update/docs/certs/brand/invite/archive) so
`/activity` is reviewable immediately as OWNER or MANAGER.

Also: pending invitations (`invitee@{brand}.test`), certs/docs/gallery on live/ready products.

Suggested review path: follow **[TESTING.md](./TESTING.md)** (20-minute checklist: brand MVP →
roles → platform admin → multi-brand isolation).

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
| Testing guide (reviewer checklist) | [TESTING.md](./TESTING.md) |
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

Full-text product search, passport versioning, soft delete, **Activity** feed (humanised audit log
with date-scoped pagination), Redis caching (dashboard / analytics / public passport + Redis scan
queue with memory fallback), pagination / filters, passport PDF export, drag-and-drop
uploads with server magic-byte checks, unit tests, CI (`.github/workflows/ci.yml`).

The assessment nav (Dashboard, Products, Product Passports, Analytics, Users, Settings) is present;
**Activity** is an extra sidebar item for the audit UX.

---

## Architecture docs

- [TESTING.md](./TESTING.md) — reviewer testing guide (accounts, checklists, feature map)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design, decisions, security, scalability, future work
- [docs/DATA-MODEL.md](./docs/DATA-MODEL.md) — schema, tenancy invariants, integrity notes
