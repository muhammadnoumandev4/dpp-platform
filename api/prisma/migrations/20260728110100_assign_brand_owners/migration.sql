-- The first active tenant user created in each organisation is the account
-- that registered the brand. Promote that account to Owner without changing
-- invited users or the separate platform-admin identities.
WITH ranked_brand_users AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "organisationId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS position
  FROM users
  WHERE "disabledAt" IS NULL
    AND role <> 'ADMINISTRATOR'
)
UPDATE users
SET role = 'OWNER'
WHERE id IN (
  SELECT id
  FROM ranked_brand_users
  WHERE position = 1
);
