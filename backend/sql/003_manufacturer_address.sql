-- Apply after 001 and 002. Existing business data is preserved.
BEGIN;
ALTER TABLE midmap.canonical_manufacturers
    ADD COLUMN IF NOT EXISTS address text,
    ADD COLUMN IF NOT EXISTS city text,
    ADD COLUMN IF NOT EXISTS zipcode text;
COMMIT;
