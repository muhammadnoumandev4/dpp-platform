# Architecture

This document describes the system architecture, design decisions, database design, security
approach, scalability considerations and possible future improvements of the Digital Product
Passport (DPP) platform. The detailed schema reference lives in
[docs/DATA-MODEL.md](./docs/DATA-MODEL.md).

## 1. System architecture

The platform is two applications sharing one PostgreSQL database, deployed with Docker Compose:

```text
┌────────────┐  QR scan   ┌─────────────────────┐        ┌──────────────────────┐
│  End user  │ ─────────► │  Next.js 14 (web)   │  HTTP  │   NestJS 11 (api)    │
│  (public)  │            │  :3001              │ ─────► │   :3000              │
└────────────┘            │  back office +      │        │  modular monolith    │
┌────────────┐  cookie    │  public passport    │        └──────┬───────┬───────┘
│ Brand user │ ─────────► │  pages              │               │       │
└────────────┘            └─────────────────────┘        ┌──────▼──┐ ┌──▼──────┐
                                                          │Postgres │ │  Redis  │
                                                          └─────────┘ └─────────┘
```

- **API** — a modular NestJS monolith. Each domain (auth, organisations, invitations, users,
  taxonomy, products, passports, uploads, qr, scans, analytics, audit, platform-admin) is an
  isolated module with its own controller, service, and DTOs. Swagger is generated from typed
  DTOs via the `@nestjs/swagger` CLI plugin and served at `/api/docs`.
- **Web** — a Next.js App Router application. The back office lives under an authenticated
  `(dashboard)` layout; the public passport page (`/passport/[uuid]`) is a separate unauthenticated
  route. The editor Preview tab defaults to the **published immutable snapshot** (exact consumer
  view) when one exists, with an optional Draft toggle for work-in-progress content — both use the
  shared `PassportView` component.
- **Postgres** — the single source of truth, with integrity invariants pushed into the schema
  (CHECK constraints, partial unique indexes, composite tenant foreign keys).
- **Redis** — shared cache for dashboard/analytics aggregates and public passport payloads, plus a
  Redis list for the scan write queue across API replicas, with automatic in-memory fallback so the
  stack degrades gracefully when Redis is absent.

### Request flows

1. **Back office**: browser → Next.js → API with an httpOnly JWT cookie. Guards resolve the user,
   then a permission guard checks the endpoint's required permission against the role's permission
   set. Every read and write is additionally scoped by `organisationId`.
2. **Public passport**: a QR scan opens `/passport/{uuid}` (with `?src=qr` for source
   attribution). Next.js SSR fetches the *published snapshot* with `x-skip-scan: 1` (cacheable,
   never the draft). A client `ScanBeacon` then `POST`s `/passport/:uuid/scan` so analytics capture
   the real browser IP/UA. Direct API GETs without the skip header still record a scan (curl /
   no-JS). Writes are enqueued on a bounded in-process scan queue.
3. **Publication**: `POST /products/:id/publish` runs one transaction that row-locks the product
   and passport, revalidates the full product graph (materials sum to 100%, cover image present,
   required fields), writes an immutable `PassportVersion` JSON snapshot, advances the version and
   flips product state.

## 2. Design decisions

- **Modular monolith over microservices (and over textbook Clean Architecture).** One deployable
  API keeps transactions local (publishing is a single ACID transaction across product, passport
  and version rows) and operations simple. Code is organised by Nest feature modules with clear
  controller → service → Prisma boundaries and one real port (`ObjectStorage`). That satisfies the
  assessment's "Clean Architecture / SOLID" intent as **modular, dependency-inverted where it
  matters**, without introducing unused domain/repository ceremony for an MVP-sized surface.
- **Draft/snapshot separation.** `Product` is mutable; `PassportVersion` is an append-only JSON
  snapshot. The public page serves only snapshots, which makes public data immutable, versioned
  and auditable, and lets brands edit drafts without affecting what consumers see until republish.
- **Stable public identity.** The passport UUID and QR are minted once at first publication and
  never change across republish, unpublish/republish or draft edits — printed QR codes on physical
  products must never go stale.
- **Soft delete preserves passports.** Archiving a product removes it from the back office but
  keeps its last issued passport intact; public access is withdrawn only by the explicit Unpublish
  action. A physical product's passport should not vanish because of back-office housekeeping.
- **Permission-based authorization, not role checks.** Endpoints declare required permissions
  (`products.publish`, `users.manage`, …) and roles map to permission sets in one file. Adding a
  role or adjusting access is a data change, not a code sweep.
- **Curated taxonomy over free text.** Categories, countries and material presets are per-tenant
  catalog tables referenced by foreign key, which keeps passport data consistent and filterable.
- **Fail-soft cache.** All caching goes through one service that transparently falls back to an
  in-memory store, so Redis is an optimisation, never a dependency.
- **Validation in depth.** Client-side form validation, DTO validation
  (`whitelist + forbidNonWhitelisted`), service-level publish validation, and database CHECK
  constraints all encode the same rules; the database is the last line of defence.

## 3. Database design

The schema is normalised (3NF); full details and invariants are in
[docs/DATA-MODEL.md](./docs/DATA-MODEL.md).

```text
Organisation 1─N User          Organisation 1─N Product ──1 Sustainability
Organisation 1─N Invitation    Product 1─N Material ──► Country (FK, same org)
Organisation 1─N Category      Product 1─N Certification (PDF fileKey)
Organisation 1─N Country       Product 1─N ProductDocument (MANUAL|WARRANTY|DATASHEET)
Organisation 1─N AuditLogEntry Product 1─N ProductImage (partial-unique cover)
                               Product 1──1 Passport 1─N PassportVersion (immutable)
                                             Passport 1─N Scan
```

Key integrity mechanisms, enforced in PostgreSQL rather than only in application code:

- **Tenant isolation at the FK level.** `Category`, `Country` and `Product` carry composite unique
  keys `(id, organisationId)`, and referencing rows join on both columns — a product physically
  cannot reference another tenant's taxonomy.
- **CHECK constraints** for material percentage (0, 100], recycled percent [0, 100],
  repairability [1, 10], non-negative footprint values, certification expiry ≥ issue date,
  positive file sizes, invitation roles limited to `MANAGER`/`EDITOR`, and the passport state
  invariant `publishedAt IS NULL ⇔ version = 0`.
- **Partial unique indexes** for one cover image per product, one pending invitation per email,
  one active `OWNER` per organisation, and case-insensitive unique user emails.
- **Full-text search** via a generated `tsvector` column with a GIN index; product search uses
  `plainto_tsquery` with `ts_rank` ordering.
- **Append-only versions** guarded by `@@unique(passportId, version)` and a positive-version
  check.

## 4. Security approach

- **Authentication.** Email/password with bcrypt (cost 12). The JWT (7-day expiry, fixed
  issuer/audience) is delivered in an **httpOnly, SameSite=Lax cookie**, so it is invisible to
  page JavaScript and immune to token-theft XSS patterns; Bearer headers are also accepted for API
  clients. `JWT_SECRET` is validated at boot (32-character minimum) and cookies can be forced
  `Secure` via `COOKIE_SECURE`.
- **Authorization.** A global JWT guard plus a per-endpoint permission guard. Platform staff
  (`ADMIN`) hold no tenant permissions and tenants hold no platform permissions, so the
  cross-tenant boundary is enforced on every route. All tenant queries filter by the caller's
  `organisationId`.
- **Input validation.** A global `ValidationPipe` with `whitelist`, `transform` and
  `forbidNonWhitelisted` rejects unknown fields; DTOs constrain every mutable field.
- **Upload safety.** Files are validated by **magic bytes**, not the client MIME type (JPEG, PNG
  and WebP for images; PDF for documents), stored behind a storage abstraction with
  path-traversal-safe key handling, and orphaned files are garbage-collected.
- **Transport and headers.** Helmet, an explicit CORS origin allowlist with credentials, and
  request-ID + structured request logging for traceability.
- **CSRF posture.** The JWT lives in an httpOnly `SameSite=Lax` cookie on the API origin. The
  back office is a separate origin (`WEB_PUBLIC_URL`) that mutates state only via
  `fetch(..., { credentials: 'include' })` JSON APIs — not via cookie-authenticated form POSTs
  to the API. Cross-site classic CSRF against those endpoints is blocked by the combination of
  SameSite=Lax (no cookie on cross-site POSTs from other sites) and CORS (foreign origins cannot
  read responses). Residual risk remains if a future same-site reverse proxy hosts both apps
  under one site without an anti-CSRF token; in that deployment, add a double-submit CSRF header
  or move to a BFF that sets cookies on the page origin.
- **Rate limiting.** A global throttle (100/min) tightened per route: login 5/min, brand
  registration 3/min, invitation acceptance 10/min, public passport reads 30/min, PDF export
  10/min.
- **Upload ACL.** Files are no longer world-readable via static disk mounting. `MediaController`
  serves `/uploads/:org/:purpose/:file` only to the owning tenant JWT or when the key is attached
  to a currently published passport (images, documents, certifications, QR codes, brand logo).
- **Scan privacy.** Raw visitor IPs are never persisted — only a keyed HMAC (`SCAN_IP_PEPPER` or
  `JWT_SECRET`) plus parsed user-agent fields and a resolved country.
- **Trusted-proxy IP resolution.** `ScansService` reads the client IP exclusively from Express's
  `request.ip`, which respects the `TRUST_PROXY` configuration — forwarding headers supplied by
  clients cannot spoof scan IP hashes or country.
- **Audit trail.** Every tenant mutation writes an `AuditLogEntry`; the platform console exposes
  cross-tenant history for internal staff.

## 5. Scalability considerations

- **Stateless API.** No server-side sessions; any number of API replicas can sit behind a load
  balancer. Redis (with the `dpp:` namespace) can be shared by all replicas.
- **Read-heavy public path.** Public passports serve pre-computed immutable snapshots — a single
  indexed lookup — and are the natural candidate for CDN/edge caching, since a snapshot changes
  only on republish.
- **Aggregate caching.** Dashboard and analytics totals are cached with explicit invalidation on
  product mutation, publish/unpublish, **and each recorded scan**, so back-office counters do not
  wait for TTL. Public passport payloads are cached separately and invalidated on publish,
  unpublish, and brand-profile updates (name / logo / accent are live-joined into the response).
- **Pagination everywhere.** Product lists and admin views are offset-paginated with capped page
  sizes; full-text search is index-backed.
- **Storage abstraction.** The upload layer targets an object-storage interface; swapping local
  disk for S3-compatible storage is an adapter change, not a refactor.
- **Scan write offload.** Public reads enqueue a serialisable scan payload on a Redis list
  (`dpp:scan-jobs`) shared by API replicas, with an in-process bounded deque as fallback when
  Redis is unset or unreachable. Controllers never await the DB write.
- **Health probes.** `GET /health` checks Postgres + Redis (or memory-cache fallback) and reports
  combined scan-queue depth for orchestrators.
- **Growth path.** Next steps at scale: BullMQ (retries/DLQ) if the Redis list is not enough,
  analytics rollup tables or a columnar store, partitioning `scans` by time, and extracting the
  public read path into its own deployment if traffic profiles diverge.

## 6. Possible future improvements

Informed by a feature review of two production-grade sibling platforms (an NFC authentication
panel and the Authentica NFC/DPP platform), in rough priority order:

**Anti-counterfeit and physical binding**
- **NFC support with cryptographic tag authentication** (NTAG 424 DNA SDM): per-tag AES keys,
  CMAC-verified taps, a monotonic tap counter for replay/clone detection, and a verification audit
  log with explicit verdicts. A QR code is a static, photocopiable string; SDM gives cryptographic
  proof of physical presence and is the single biggest capability gap versus both sibling
  platforms.
- **Item-level serialisation**: individual product items (serial-numbered units) under one
  passport, each with its own scannable identity — the schema already anticipates this with
  `ProductItem`.
- **Tag/chip lifecycle management**: batches, groups, provisioning states, UID binding,
  unbind/recycle, and an ordering/fulfilment workflow between brands and the platform.

**Consumer engagement**
- **Ownership claiming**: let end customers claim a purchased item (account- or wallet-based),
  with a configurable claim form, an owner portal ("my items"), and brand notifications on claim.
- **Email capture on scan** with double opt-in, per-brand messaging, and subscriber analytics —
  turning passive scans into an owned marketing audience.
- **Lost/stolen and message campaigns**: brand-configurable popups shown at scan time on selected
  items.
- **Notifications**: in-app and push notification feeds with granular preferences, digests and
  milestone alerts (e.g. scan-count achievements).

**Passport content and reach**
- **Multi-language passports** with AI-assisted translation pipelines and per-brand language
  sets.
- **Extended ESPR/circularity fields**: supply-chain steps, SVHC/hazardous-substance compliance,
  take-back schemes, expected lifespan, care instructions — aligning the passport with the
  emerging EU regulation.
- **Template presets and standard libraries** for provenance, values and history timelines, so
  brands author consistent passports faster.
- **White-labelling**: custom domains, logos, design templates and social links per brand.

**Platform and operations**
- **Bulk operations**: async CSV import and bulk passport creation with idempotency keys,
  progress tracking and rollback on error.
- **Billing and plans**: subscription tiers with passport quotas, trials and entitlement
  management (Stripe), enabling productisation.
- **Integrations**: outbound webhooks and Zapier/Mailchimp sync of scan and claim data into brand
  CRMs.
- **Optional immutable anchoring**: permanent metadata hosting (e.g. Arweave) or blockchain
  anchoring of passport snapshots for third-party verifiability, kept optional per brand.
- **Hardening backlog**: revoke active sessions when a brand is suspended, and add server-side
  filtered CSV exports for the platform console.
