-- Drop `organisations.email_collection_enabled`.
--
-- The column was never read or written by application code. Rather than leave a
-- dead toggle in the schema (which implies a consumer email-capture feature that
-- does not exist), it is removed. Reintroduce it alongside the feature if the
-- passport ever gains email collection.
ALTER TABLE "organisations" DROP COLUMN IF EXISTS "emailCollectionEnabled";
