\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  INSERT INTO organisations (id, name, "publicSlug", "createdAt", "updatedAt")
  VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'Constraint Org A', 'constraint-org-a', now(), now()),
    ('00000000-0000-4000-8000-0000000000a2', 'Constraint Org B', 'constraint-org-b', now(), now());

  INSERT INTO users (id, email, "passwordHash", name, role, "organisationId", "createdAt")
  VALUES
    ('00000000-0000-4000-8000-0000000000b1', 'constraint-owner-a@test.invalid', 'x', 'Owner A', 'OWNER', '00000000-0000-4000-8000-0000000000a1', now()),
    ('00000000-0000-4000-8000-0000000000b2', 'constraint-owner-b@test.invalid', 'x', 'Owner B', 'OWNER', '00000000-0000-4000-8000-0000000000a2', now());

  INSERT INTO categories (id, "organisationId", name)
  VALUES
    ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', 'A'),
    ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000a2', 'B');

  INSERT INTO products (id, "organisationId", name, sku, "categoryId", status, "createdAt", "updatedAt")
  VALUES ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', 'Probe', 'PROBE-1', '00000000-0000-4000-8000-0000000000c1', 'DRAFT', now(), now());

  BEGIN
    UPDATE products
    SET "categoryId" = '00000000-0000-4000-8000-0000000000c2'
    WHERE id = '00000000-0000-4000-8000-0000000000d1';
    RAISE EXCEPTION 'cross-tenant category constraint did not fire';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO users (id, email, "passwordHash", name, role, "organisationId", "createdAt")
    VALUES ('00000000-0000-4000-8000-0000000000b3', 'second-owner@test.invalid', 'x', 'Second', 'OWNER', '00000000-0000-4000-8000-0000000000a1', now());
    RAISE EXCEPTION 'single-owner constraint did not fire';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO passports (id, "productId", uuid, version, "createdAt")
    VALUES ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e2', 1, now());
    RAISE EXCEPTION 'passport state constraint did not fire';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO invitations (id, email, role, "organisationId", token, "invitedById", "createdAt", "expiresAt")
    VALUES ('00000000-0000-4000-8000-0000000000f1', 'invite@test.invalid', 'OWNER', '00000000-0000-4000-8000-0000000000a1', 'probe-token', '00000000-0000-4000-8000-0000000000b1', now(), now() + interval '1 day');
    RAISE EXCEPTION 'invite role constraint did not fire';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO passports (id, "productId", uuid, version, "createdAt")
  VALUES ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e2', 0, now());

  BEGIN
    INSERT INTO passport_versions (id, "passportId", "organisationId", version, snapshot, "publishedAt", "publishedById")
    VALUES ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a1', 1, '{}'::jsonb, now(), '00000000-0000-4000-8000-0000000000b2');
    RAISE EXCEPTION 'publisher tenant constraint did not fire';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  RAISE NOTICE 'all database integrity probes passed';
END
$$;

ROLLBACK;
