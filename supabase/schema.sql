-- =====================================================================
-- CareOps — Supabase schema
-- Multi-tenant pool model (org_id) + append-only hashed care ledger.
-- Run this in the Supabase SQL editor, then run seed.sql.
-- =====================================================================

create extension if not exists pgcrypto;  -- for digest() / sha256

-- ============================ TENANTS ============================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  line_official_id text,
  promptpay_receiver_id text,
  created_at timestamptz not null default now()
);

-- ============================ PROFILES ============================
-- One row per auth.users. role drives access.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete set null,
  role text not null default 'caregiver'
    check (role in ('operator','caregiver','family','admin')),
  full_name text not null default '',
  phone text,
  line_user_id text,
  created_at timestamptz not null default now()
);

-- ============================ PATIENTS ============================

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  address text,
  lat numeric(10,7),
  lng numeric(10,7),
  geofence_m integer not null default 200,
  care_notes text,
  created_at timestamptz not null default now()
);

-- ============================ FAMILY LINKS ============================

create table public.patient_family (
  patient_id uuid not null references public.patients(id) on delete cascade,
  family_user_id uuid not null references public.profiles(id) on delete cascade,
  relation text,
  primary key (patient_id, family_user_id)
);

-- ============================ CAREGIVERS ============================

create table public.caregivers (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  certifications jsonb not null default '[]'::jsonb,
  reliability_score numeric(3,2) not null default 5.00,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================ VISITS ============================

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  caregiver_id uuid references public.profiles(id) on delete set null,
  status text not null default 'assigned'
    check (status in ('assigned','checked_in','checked_out','completed','cancelled')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  check_in_at timestamptz,
  check_in_lat numeric(10,7),
  check_in_lng numeric(10,7),
  check_in_photo_url text,
  check_out_at timestamptz,
  check_out_lat numeric(10,7),
  check_out_lng numeric(10,7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================ CARE RECORDS (TRUST LEDGER) ============================
-- Append-only: never UPDATE/DELETE rows. Each row carries a hash-chain digest.

create table public.care_records (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  visit_id uuid not null references public.visits(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('vital','medication','note','photo','event')),
  payload jsonb not null,
  recorded_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  prev_digest text,
  digest text not null,
  created_at timestamptz not null default now()
);

-- ============================ INVOICES ============================

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  visit_id uuid references public.visits(id) on delete set null,
  amount numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  promptpay_payload text,
  created_at timestamptz not null default now()
);

-- ============================ INDEXES ============================

create index visits_org_idx on public.visits(org_id);
create index visits_patient_idx on public.visits(patient_id);
create index visits_caregiver_idx on public.visits(caregiver_id);
create index care_records_visit_idx on public.care_records(visit_id);
create index care_records_org_idx on public.care_records(org_id);
create index patients_org_idx on public.patients(org_id);

-- ============================ HELPERS ============================

-- Current user's org id (null if none).
create or replace function public.current_org_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- Current user's role.
create or replace function public.current_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Is the current user a linked family member of this patient?
create or replace function public.is_family_of(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.patient_family pf
    where pf.patient_id = p_patient_id
      and pf.family_user_id = auth.uid()
  );
$$;

-- Deterministic hash for one care record (shared by app + anyone verifying the chain).
create or replace function public.care_record_digest(
  p_prev text, p_kind text, p_payload jsonb, p_actor uuid, p_ts timestamptz
)
returns text
language sql immutable
as $$
  select encode(
    digest(
      concat_ws('|',
        coalesce(p_prev, ''),
        p_kind,
        coalesce(p_payload::text, ''),
        coalesce(p_actor::text, ''),
        coalesce(p_ts::text, '')
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- Auto-compute the hash-chain digest on insert (single source of truth for the ledger).
create or replace function public.set_care_record_digest()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  prev text;
begin
  -- Serialize inserts per visit so the chain stays strictly ordered.
  perform pg_advisory_xact_lock(hashtext(new.visit_id::text));

  select digest into prev
    from public.care_records
    where visit_id = new.visit_id
    order by seq desc
    limit 1;

  new.prev_digest := prev;
  new.digest := public.care_record_digest(
    prev, new.kind, new.payload, new.created_by, new.recorded_at
  );
  return new;
end;
$$;

create trigger care_records_digest
  before insert on public.care_records
  for each row execute function public.set_care_record_digest();

-- Verify an entire visit's hash chain (returns false on the first broken link).
create or replace function public.verify_care_chain(p_visit_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  prev text := null;
  rec record;
  expected text;
begin
  for rec in
    select * from public.care_records
    where visit_id = p_visit_id
    order by seq asc
  loop
    expected := public.care_record_digest(
      prev, rec.kind, rec.payload, rec.created_by, rec.recorded_at
    );
    if expected is distinct from rec.digest then
      return false;
    end if;
    prev := rec.digest;
  end loop;
  return true;
end;
$$;

-- ============================ TRIGGERS ============================

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep visits.updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger visits_touch before update on public.visits
  for each row execute function public.touch_updated_at();

-- ============================ ROW LEVEL SECURITY ============================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.patient_family enable row level security;
alter table public.caregivers enable row level security;
alter table public.visits enable row level security;
alter table public.care_records enable row level security;
alter table public.invoices enable row level security;

-- organizations: only members of that org can read it.
create policy org_select on public.organizations
  for select using (id = public.current_org_id());

-- profiles: you can read your own row or, if operator/admin, your org's members.
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or (public.current_role() in ('operator','admin') and org_id = public.current_org_id())
  );
create policy profiles_update on public.profiles
  for update using (id = auth.uid());

-- patients: org members read/write; linked family read.
create policy patients_select on public.patients
  for select using (
    org_id = public.current_org_id() or public.is_family_of(id)
  );
create policy patients_insert on public.patients
  for insert with check (org_id = public.current_org_id());
create policy patients_update on public.patients
  for update using (org_id = public.current_org_id());
create policy patients_delete on public.patients
  for delete using (org_id = public.current_org_id());

-- patient_family: org members (of the patient's org) or the family member themselves.
create policy pf_select on public.patient_family
  for select using (
    family_user_id = auth.uid()
    or exists (
      select 1 from public.patients p
      where p.id = patient_id and p.org_id = public.current_org_id()
    )
  );
create policy pf_insert on public.patient_family
  for insert with check (
    family_user_id = auth.uid()
    or exists (
      select 1 from public.patients p
      where p.id = patient_id and p.org_id = public.current_org_id()
    )
  );
create policy pf_delete on public.patient_family
  for delete using (
    family_user_id = auth.uid()
    or exists (
      select 1 from public.patients p
      where p.id = patient_id and p.org_id = public.current_org_id()
    )
  );

-- caregivers: org members read/write.
create policy caregivers_select on public.caregivers
  for select using (org_id = public.current_org_id());
create policy caregivers_insert on public.caregivers
  for insert with check (org_id = public.current_org_id());
create policy caregivers_update on public.caregivers
  for update using (org_id = public.current_org_id());

-- visits: org members read/write; linked family read.
create policy visits_select on public.visits
  for select using (
    org_id = public.current_org_id() or public.is_family_of(patient_id)
  );
create policy visits_insert on public.visits
  for insert with check (org_id = public.current_org_id());
create policy visits_update on public.visits
  for update using (org_id = public.current_org_id());
create policy visits_delete on public.visits
  for delete using (org_id = public.current_org_id());

-- care_records: append-only. Org members insert/select; linked family select only.
create policy cr_select on public.care_records
  for select using (
    org_id = public.current_org_id()
    or exists (
      select 1 from public.visits v
      join public.patient_family pf on pf.patient_id = v.patient_id
      where v.id = care_records.visit_id and pf.family_user_id = auth.uid()
    )
  );
create policy cr_insert on public.care_records
  for insert with check (org_id = public.current_org_id());
-- NOTE: intentionally NO update/delete policy → rows are append-only.

-- invoices: org members read/write; linked family read.
create policy invoices_select on public.invoices
  for select using (
    org_id = public.current_org_id() or public.is_family_of(patient_id)
  );
create policy invoices_insert on public.invoices
  for insert with check (org_id = public.current_org_id());
create policy invoices_update on public.invoices
  for update using (org_id = public.current_org_id());
