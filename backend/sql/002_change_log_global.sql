-- allow global_* rows to omit flight fields
ALTER TABLE midmap.change_log
  ALTER COLUMN airline_3d       DROP NOT NULL,
  ALTER COLUMN master_bill_no   DROP NOT NULL,
  ALTER COLUMN arrival_airport  DROP NOT NULL,
  ALTER COLUMN arrival_date     DROP NOT NULL,
  ALTER COLUMN manufacturer_name DROP NOT NULL;

-- Remove any old functional indexes that might conflict (safe if absent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'u_change_log_auto') THEN
    EXECUTE 'DROP INDEX IF EXISTS midmap.u_change_log_auto';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'u_change_log_global_alias') THEN
    EXECUTE 'DROP INDEX IF EXISTS midmap.u_change_log_global_alias';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'u_change_log_global_name') THEN
    EXECUTE 'DROP INDEX IF EXISTS midmap.u_change_log_global_name';
  END IF;
END $$;

-- ✅ Plain-column, action-scoped unique indexes (no functions)
-- (Relies on your app sending UPPERCASE bad_mid/good_mid/arrival_airport)

CREATE UNIQUE INDEX IF NOT EXISTS u_change_log_global_alias
  ON midmap.change_log (bad_mid, good_mid)
  WHERE action = 'global_alias';

CREATE UNIQUE INDEX IF NOT EXISTS u_change_log_global_name
  ON midmap.change_log (manufacturer_name, good_mid)
  WHERE action = 'global_name';

-- Postgres 15+ supports NULLS NOT DISTINCT so NULLs are treated as equal
CREATE UNIQUE INDEX IF NOT EXISTS u_change_log_auto
  ON midmap.change_log (
    arrival_date,
    airline_3d,
    master_bill_no,
    arrival_airport,
    client_name,
    bad_mid,
    good_mid
  ) NULLS NOT DISTINCT
  WHERE action IN ('auto_alias','auto_name');

