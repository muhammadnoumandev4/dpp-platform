# Testing guide — Digital Product Passport (DPP)

Use this checklist when reviewing the submission. Password for **every** seeded account:

```text
password123
```

## 1. Start the stack

```bash
git clone https://github.com/muhammadnoumandev4/dpp-platform.git
cd dpp-platform
cp .env.example .env
openssl rand -base64 48   # paste into .env as JWT_SECRET=
docker compose up --build
```

| Service | URL |
|---|---|
| Web app | http://localhost:3001 |
| Login | http://localhost:3001/login |
| Platform admin | http://localhost:3001/admin |
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/api/docs |

Seed runs automatically when `RUN_SEED=true` (default in `.env` / Compose).

---

## 2. Who to log in as

### Platform (cross-tenant)

| Email | Role | Purpose |
|---|---|---|
| `admin@notarify.test` | ADMIN | Platform console — all brands, totals, suspend/reactivate |

### Primary brand — Notarify (start here)

| Email | Role | Can do |
|---|---|---|
| `editor@notarify.test` | **OWNER** | Everything in the brand (products, publish, users, settings, soft-delete, Activity) |
| `manager@notarify.test` | MANAGER | Create/edit/publish + Activity — **not** team or archive |
| `member@notarify.test` | EDITOR | Create/edit drafts — **cannot** publish, **no** Activity |

### Other brands (multi-tenant / admin QA)

| Brand | OWNER | MANAGER | EDITOR | Notes |
|---|---|---|---|---|
| Atlas Goods | `owner@atlasgoods.test` | `manager@atlasgoods.test` | `editor@atlasgoods.test` | Outdoor |
| Lumina Home | `owner@luminahome.test` | `manager@luminahome.test` | `editor@luminahome.test` | Home |
| Verde Beauty | `owner@verdebeauty.test` | `manager@verdebeauty.test` | `editor@verdebeauty.test` | Beauty |
| Harbor Labs | `owner@harborlabs.test` | `manager@harborlabs.test` | `editor@harborlabs.test` | **Suspended** |

Each non-Notarify brand also has spare accounts: `{atl\|lum\|vrd\|hbr}.manager@demo.test` and `.editor@demo.test`.

---

## 3. Suggested 20-minute review path

### A. Brand MVP (Notarify OWNER) — ~10 min

1. Login as `editor@notarify.test`.
2. **Dashboard** — totals for products, published passports, QR counts, views.
3. **Products** — you should see several SKUs (draft, ready, live, etc.).
4. Open **`NTF-4192-BLK` (Merino Crew Knit)** → try **Publish** → expect blockers (missing cover).
5. Open **`NTF-READY-001` (Linen Overshirt)** → **Publish** → QR + public URL appear.
6. Open passport (`Open Passport` or copy URL) with `?src=qr` → public page loads without login.
7. **Analytics** — scans today / week / most viewed / latest scans (seed has history on live SKUs).
8. **Product Passports** — list published passports; open QR dialog / public link.
9. Open **`NTF-LIVE-100`** → tabs: Materials, Sustainability, Certifications, Documents, Images, Inventory, Preview, version history after publish.
10. **Users** — see Manager/Editor; pending invitation for `invitee@notarify.test`.
11. **Activity** — team change feed in plain language (search / filters / export). Bonus beyond the six core nav items; replaces the old Settings audit tab.
12. **Settings** — brand profile (name, accent, website).

### B. Permission boundaries — ~3 min

1. Logout → login `member@notarify.test` (EDITOR).
2. Confirm you can edit a draft but **Publish** is blocked / unavailable.
3. Logout → login `manager@notarify.test`.
4. Confirm publish works; Users / soft-delete / settings are restricted vs OWNER.

### C. Platform admin — ~5 min

1. Login as `admin@notarify.test` → lands on `/admin`.
2. See **multiple brands** (Notarify, Atlas, Lumina, Verde, Harbor).
3. Open brand detail — products, passports, scans, users.
4. **Harbor Labs** is suspended — try **Reactivate** (and optionally suspend another brand).
5. Confirm platform charts / totals reflect multi-brand scan activity.
6. Confirm this admin **cannot** use the normal brand product editor as a tenant (no `organisationId`).

### D. Multi-brand isolation — ~2 min

1. Login as `owner@atlasgoods.test`.
2. Products list should show **Atlas** SKUs only (`ATL-…`), not Notarify.
3. Analytics should reflect Atlas scans only.
4. Repeat optionally with Lumina / Verde owners.

---

## 4. Seeded product states (every brand)

SKU prefixes: `NTF` · `ATL` · `LUM` · `VRD` · `HBR`

| State | Notarify example | What it proves |
|---|---|---|
| Incomplete draft | `NTF-4192-BLK` | Publish validation / blockers |
| Ready to publish | `NTF-READY-001` | Happy-path publish + QR |
| Live + analytics | `NTF-LIVE-100`, `NTF-LIVE-200` | Public passport, scans, inventory items, versions |
| Unpublished | `NTF-OFF-300` | Public URL withdrawn |
| Soft-deleted | `NTF-ARCH-200` | Archive (not hard delete) |
| Minimal draft | `NTF-EMPTY-400` | Edit / form flows |

Live products include cover/gallery images, certifications PDF, documents, and scan history for analytics.

---

## 5. Feature coverage map

| Area | How to verify |
|---|---|
| Auth (JWT cookie) | Login/logout; refresh keeps session |
| Roles | OWNER vs MANAGER vs EDITOR vs ADMIN (sections above) |
| Product CRUD | Create product; edit tabs; soft-delete |
| Materials / Sustainability | Tabs on any rich product |
| Certifications / Documents / Images | Downloads + cover on live/ready SKUs |
| Publish / snapshot | Publish ready SKU; edit draft; public page unchanged until republish |
| Stable QR / UUID | Republish — UUID/QR stay the same |
| Public passport | `/passport/{uuid}` no auth; responsive |
| QR scan tracking | Open passport with `?src=qr`; check Analytics |
| Analytics | Brand analytics page + admin platform charts |
| Users / invitations | Users screen; pending invite |
| Activity (audit UX) | Sidebar → Activity; publish/edit a product and confirm the sentence appears |
| Settings | Brand profile fields |
| Platform admin | `/admin` multi-brand + suspend |
| Swagger | http://localhost:3000/api/docs |
| Docker | Single `docker compose up --build` |

---

## 6. API smoke (optional)

After login in the browser (cookie set), or via Swagger “Authorize”:

- `GET /dashboard`
- `GET /products`
- `GET /analytics?days=30`
- `GET /passport/{uuid}` (public, no auth)
- `POST /products/{id}/publish` (as OWNER/MANAGER)

---

## 7. Automated checks (optional)

```bash
npm --prefix api test -- --runInBand
npm --prefix web run lint
npx --prefix web tsc --noEmit
```

---

## 8. Reset demo data

```bash
docker compose down -v
# ensure RUN_SEED=true in .env
docker compose up --build
```

This wipes Postgres/Redis/uploads volumes and re-seeds all brands.

---

## 9. Expected talking points (architecture)

If you discuss the submission with the candidate (or evaluate docs):

- **Draft vs snapshot** — public page serves immutable `PassportVersion`, not live draft
- **Stable UUID/QR** across republish
- **Tenant isolation** — `organisationId` on data + permission guards
- **Soft-delete vs Unpublish** — archive ≠ withdraw public access
- Docs: [README.md](./README.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [docs/DATA-MODEL.md](./docs/DATA-MODEL.md)
