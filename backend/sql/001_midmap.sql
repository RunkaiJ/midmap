create schema if not exists midmap;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'change_action') then
    create type midmap.change_action as enum (
      'auto_alias',        -- resolved via bad_mid → good_mid
      'auto_name',         -- resolved via manufacturer_name → good_mid
      'manual_triplet',    -- user added bad_mid,name → good_mid
      'manual_alias',      -- user added bad_mid → good_mid
      'manual_name'        -- user added name → good_mid
    );
  end if;
end $$;

create table if not exists midmap.clients (
  importer_id text primary key,
  client_name text not null
);

insert into midmap.clients (importer_id, client_name)
values ('2567947','SHEIN')
on conflict (importer_id) do update set client_name = excluded.client_name;

create table if not exists midmap.canonical_manufacturers (
  id bigserial primary key,
  good_mid text not null unique,
  manufacturer_name text,
  created_at timestamptz default now()
);

create table if not exists midmap.mid_aliases (
  id bigserial primary key,
  bad_mid text not null unique,
  good_manufacturer_id bigint not null references midmap.canonical_manufacturers(id) on delete restrict,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists midmap.name_mappings (
  id bigserial primary key,
  manufacturer_name text not null unique,
  good_manufacturer_id bigint not null references midmap.canonical_manufacturers(id) on delete restrict,
  created_by text,
  created_at timestamptz default now()
);

create index if not exists idx_mid_aliases_good on midmap.mid_aliases(good_manufacturer_id);
create index if not exists idx_name_maps_good  on midmap.name_mappings(good_manufacturer_id);

create table if not exists midmap.upload_batches (
  id bigserial primary key,
  created_at timestamptz default now(),
  created_by text,
  source_filename text,
  importer_id text,
  client_name text
);

create table if not exists midmap.upload_rows (
  id bigserial primary key,
  batch_id bigint not null references midmap.upload_batches(id) on delete cascade,

  airline_3d char(3) not null,
  master_bill_no text not null,
  importer_id text,
  client_name text,
  arrival_airport text,
  arrival_date date,

  manufacturer_name text,
  bad_mid text,

  good_manufacturer_id bigint references midmap.canonical_manufacturers(id) on delete set null,
  resolution_method midmap.change_action,
  resolved_at timestamptz,
  resolved boolean not null default false
);

create index if not exists idx_upload_rows_batch_resolved on midmap.upload_rows(batch_id, resolved);
create index if not exists idx_upload_rows_keys on midmap.upload_rows(airline_3d, master_bill_no);
create index if not exists idx_upload_rows_eta on midmap.upload_rows(arrival_date);
create index if not exists idx_upload_rows_branch on midmap.upload_rows(arrival_airport);

create table if not exists midmap.change_log (
  id bigserial primary key,
  batch_id bigint references midmap.upload_batches(id) on delete set null,
  upload_row_id bigint references midmap.upload_rows(id) on delete set null,

  action midmap.change_action not null,
  changed_at timestamptz default now(),
  changed_by text,

  airline_3d char(3) not null,
  master_bill_no text not null,
  importer_id text,
  client_name text,
  arrival_airport text,
  arrival_date date,

  from_bad_mid text,
  from_manufacturer_name text,
  to_good_mid text not null
);

create index if not exists idx_changes_client       on midmap.change_log(client_name);
create index if not exists idx_changes_eta          on midmap.change_log(arrival_date);
create index if not exists idx_changes_branch       on midmap.change_log(arrival_airport);
create index if not exists idx_changes_keypair      on midmap.change_log(airline_3d, master_bill_no);
create index if not exists idx_changes_changed_at   on midmap.change_log(changed_at desc);

create or replace view midmap.v_mid_change_report as
select
  c.changed_at,
  coalesce(c.client_name, 'Unknown') as client,
  c.arrival_airport as branch,
  c.airline_3d,
  c.master_bill_no,
  c.arrival_airport,
  c.arrival_date,
  c.from_bad_mid    as bad_mid,
  c.to_good_mid     as good_mid,
  c.from_manufacturer_name as manufacturer_name,
  c.action
from midmap.change_log c;
