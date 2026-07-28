# Data model

This document describes the **implemented** database schema (`api/prisma/schema.prisma` plus raw-SQL
migrations). It supersedes earlier single-tenant design drafts: the built system is multi-tenant, and
several early design concerns (QR/URL stability across republish, active-version enforcement, email
case sensitivity, raw-IP retention) are resolved structurally rather than procedurally, as noted per
entity below.

## 1. Entity overview

```text
organisations (tenant root)
  ├── users ── invitations
  ├── categories, countries, material_presets   (tenant-scoped catalogs)
  ├── products
  │     ├── materials
  │     ├── sustainability        (1:1)
  │     ├── certifications
  │     ├── documents
  │     ├── product_images
  │     └── passports             (1:1, permanent public identity)
  │           ├── passport_versions   (immutable published snapshots)
  │           ├── product_items       (optional per-unit serials/QRs)
  │           └── scans               (public analytics events)
  └── audit_log_entries

Internal staff are `users` rows with role = ADMIN and organisationId = NULL (no separate table).
Their actions land in audit_log_entries with organisationId = NULL.
```

`Product` is the mutable authoring record. `Passport` is created once per product and owns the
permanent public `uuid`, `qrKey` and `qrUrl`. Publishing writes the full product graph into a new
immutable `PassportVersion` snapshot; public reads serve only the latest snapshot, never the live
draft.

## 2. Tenancy

Every tenant-owned table carries `organisationId`, derived server-side from the authenticated
principal — never from request input. Beyond service-layer checks, tenancy is enforced by PostgreSQL
itself via composite `(id, organisationId)` unique keys and composite foreign keys, so a guessed UUID
from another organisation cannot be linked to a product, invitation, material or audit entry through
any path (direct SQL, imports, missed application checks):

- `products.categoryId` → `categories(id, organisationId)`
- `products.countryOfOriginId` → `countries(id, organisationId)`
- `materials.productId` → `products(id, organisationId)` (and the same for its country reference)
- `invitations.invitedById` and `audit_log_entries.actorId` → `users(id, organisationId)`

Tenant-scoped uniqueness: product SKU (among non-deleted rows via partial unique
index), category name and country code are unique **per organisation**, not globally.

## 3. Identity and roles

- The `Role` enum is `ADMIN`, `OWNER`, `MANAGER`, `EDITOR`. `OWNER`/`MANAGER`/`EDITOR` are tenant
  roles and require an `organisationId`; `ADMIN` is internal platform staff and carries
  `organisationId = NULL`. An earlier design kept staff in a dedicated `PlatformAdmin` table with its
  own auth strategy — the `unified_login` migration dropped it (marker comment at `schema.prisma:60`)
  in favour of one identity table and one login endpoint. `organisationId` is therefore nullable on
  `users`, and the tenant/platform boundary is enforced by the per-endpoint permission guard
  (`api/src/auth/permissions.ts`) rather than by table separation. No invitation or registration path
  can assign `ADMIN`.
- Emails are canonicalized to lowercase/trimmed, with a `lower(email)` unique index on `users` and a
  partial unique index allowing **one pending invitation per (organisation, email)**.
- A partial unique index enforces **one active OWNER per organisation**
  (`WHERE role = 'OWNER' AND disabledAt IS NULL`); a CHECK constraint keeps invitations to
  `MANAGER`/`EDITOR` only.
- Users are deactivated (`disabledAt`), never hard-deleted, preserving audit and publication
  references. JWT validation reloads `disabledAt` on every request, so removal is immediate.

## 4. Products and child tables

`products` carries authoring state (`DRAFT`/`PUBLISHED`), soft delete (`deletedAt`), and a stored
generated `tsvector` over name/SKU/description with a GIN index for ranked search.

Child tables cascade on product delete and are backstopped by CHECK constraints (the DTO layer
validates first; the database rejects anything that bypasses it):

- `materials.percentage` in `(0, 100]`
- `sustainability.recycledPercent` in `[0, 100]`, `repairabilityScore` in `[1, 10]`,
  carbon/water values non-negative
- `certifications.expiryDate >= issueDate` when both present
- `documents.sizeBytes > 0`
- **one cover image per product** via a partial unique index on
  `product_images(productId) WHERE isCover = true`

## 5. Passport, versions and QR stability

The early design draft minted a new passport UUID (and therefore a new QR/URL) per published
version — which would break QR codes already printed on physical products. The implemented model
avoids the problem structurally:

- `Passport` is a 1:1 singleton per product holding the permanent `uuid`, `qrKey`, `qrUrl`.
  Republishing never reissues any of them; the printed QR always resolves to the latest snapshot.
- `PassportVersion` rows are immutable JSON snapshots with `UNIQUE(passportId, version)`.
- There is no per-version status flag to drift out of sync. "The active version" is simply the
  highest version, and a CHECK constraint makes inconsistent states unrepresentable:
  `publishedAt IS NULL ⇔ version = 0`, with `passport_versions.version >= 1`.

### Publish transaction

Publish runs in one transaction: it takes `SELECT ... FOR UPDATE` on the product **and** passport
rows, revalidates the locked graph (preventing an edit/validation race), writes the snapshot,
increments the version pointer and flips the product status. Concurrent publishes serialize on the
row locks, with the unique version constraint as backstop. QR file I/O stays outside the lock — a
failed race can leave an inert QR object but never a partial database version.

Unpublish (`unpublishedAt`) withdraws public access explicitly; soft-deleting a product archives the
authoring record while preserving the issued passport identity.

## 6. Scans and privacy

`scans` records public passport reads asynchronously (analytics failure cannot break a consumer
read). Notable properties:

- **QR scans are distinguished from direct visits.** The generated QR image encodes
  `{publicUrl}?src=qr`; the public page forwards that marker as an `x-scan-source` header and each
  scan records `source` (`QR` | `DIRECT`, enum `ScanSource`). Rows without the marker — including
  visits from QRs printed before this column existed — default to `DIRECT`.
- **No raw IP is ever stored** — `ipHash` is a keyed HMAC-SHA256 (`SCAN_IP_PEPPER` or
  `JWT_SECRET`), and `ipTruncated` stores a privacy-reduced IP form (last octet / IPv6 hextets
  redacted) to satisfy QR-tracking requirements without retaining the full address. Client-spoofable
  country headers (`x-country-code`) are ignored unless `TRUST_PROXY` is set (in which case
  Cloudflare's `cf-ipcountry` may be used). Values are populated from the trusted-proxy-aware
  `request.ip`.
- Deduplication: the browser sends one random scan ID per page load; the API hashes
  `{passportId}:{scanId}` into a unique `dedupKey`, collapsing client retry duplicates while
  counting genuine revisits.
- Indexed on `(passportId, timestamp)` and `(timestamp)` for aggregation queries.

## 7. Audit log

`audit_log_entries` uses a free-text `action` string (not an enum), so new actions (e.g. revoke,
supersede, brand registration) never require a schema migration. Entries reference the actor via a
tenant-composite foreign key with `ON DELETE RESTRICT` — actors are deactivated, not deleted, so
history stays intact. Platform-admin actions (`BRAND_SUSPENDED`, `BRAND_REACTIVATED`) are written to
this same table with `organisationId = NULL`, which is how they are distinguished from tenant
entries; there is no separate platform audit table.

## 8. Timestamps

`updatedAt` columns are maintained by Prisma's `@updatedAt` on every write path; the publish flow
relies on this to compute `hasUnpublishedChanges` (draft edited after last snapshot). All timestamps
are stored in UTC.

## 9. Verified invariants

Cross-tenant taxonomy/publisher links, a single active owner per organisation, invitation role
allow-lists, and valid passport state transitions are enforced in PostgreSQL via CHECK constraints
and composite foreign keys in `prisma/migrations/`, with matching coverage in the Nest unit suite
(auth, products, passports). Publish v1 → draft edit → snapshot immutability → republish v2 with a
stable UUID is covered by `passports.service` tests and the publication contract in the README.

Two caveats on how these invariants are held:

- Every CHECK constraint and partial unique index above lives in raw SQL inside
  `prisma/migrations/`, not in `schema.prisma`. Prisma's model file has no representation for them,
  so a future `prisma migrate dev --create-only` diff or a `db push` can silently drop them. Review
  generated migrations against this document before applying.
- `PassportVersion` immutability is a convention, not a database guarantee: no current code path
  updates a version row, but nothing at the schema or permission level prevents one from doing so.
  `UNIQUE(passportId, version)` only constrains numbering, not snapshot content.
- `product_items.serialNumber` is nullable and carries no uniqueness constraint, while
  `generateItems` derives serials from a non-transactional `count()`. Concurrent generation can
  therefore mint duplicate serials that persist undetected; `@@unique([passportId, serialNumber])`
  plus in-transaction allocation is the fix.
