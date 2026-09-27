-- VayuNetra report persistence and access control.
-- Public clients use Next.js API projections; direct public table access is disabled.
begin;

create table if not exists public.vayunetra_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  description text,
  language text not null default 'en',
  location_text text,
  latitude double precision
    constraint vayunetra_reports_latitude_check
    check (latitude is null or latitude between -90 and 90),
  longitude double precision
    constraint vayunetra_reports_longitude_check
    check (longitude is null or longitude between -180 and 180),
  category text not null default 'other'
    constraint vayunetra_reports_category_check
    check (
      category in (
        'industrial',
        'vehicular',
        'burning',
        'dust',
        'air_pollution',
        'water_pollution',
        'waste',
        'noise',
        'other'
      )
    ),
  severity text not null default 'moderate'
    constraint vayunetra_reports_severity_check
    check (severity in ('low', 'moderate', 'high', 'critical')),
  summary text,
  possible_sources jsonb not null default '[]'::jsonb,
  recommended_action text,
  confidence double precision
    constraint vayunetra_reports_confidence_check
    check (confidence is null or confidence between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  source text not null default 'citizen',
  is_sample boolean not null default false,
  status text not null default 'reported'
    constraint vayunetra_reports_status_check
    check (status in ('reported', 'reviewed', 'resolved', 'rejected'))
);

-- Adopt the existing application-created table without changing existing rows.
alter table public.vayunetra_reports
  add column if not exists description text;

alter table public.vayunetra_reports
  add column if not exists language text not null default 'en';

alter table public.vayunetra_reports
  add column if not exists location_text text;

alter table public.vayunetra_reports
  add column if not exists latitude double precision;

alter table public.vayunetra_reports
  add column if not exists longitude double precision;

alter table public.vayunetra_reports
  add column if not exists category text not null default 'other';

alter table public.vayunetra_reports
  add column if not exists severity text not null default 'moderate';

alter table public.vayunetra_reports
  add column if not exists summary text;

alter table public.vayunetra_reports
  add column if not exists possible_sources jsonb not null default '[]'::jsonb;

alter table public.vayunetra_reports
  add column if not exists recommended_action text;

alter table public.vayunetra_reports
  add column if not exists confidence double precision;

alter table public.vayunetra_reports
  add column if not exists evidence jsonb not null default '{}'::jsonb;

alter table public.vayunetra_reports
  add column if not exists source text not null default 'citizen';

alter table public.vayunetra_reports
  add column if not exists is_sample boolean not null default false;

alter table public.vayunetra_reports
  add column if not exists status text not null default 'reported';

alter table public.vayunetra_reports
  add column if not exists created_at timestamptz not null default now();

create index if not exists vayunetra_reports_created_at_idx
  on public.vayunetra_reports (created_at desc);

create index if not exists vayunetra_reports_location_idx
  on public.vayunetra_reports (latitude, longitude)
  where latitude is not null and longitude is not null;

alter table public.vayunetra_reports enable row level security;
alter table public.vayunetra_reports force row level security;

-- Public/anonymous clients must use the validated Next.js API.
revoke all on public.vayunetra_reports from public, anon;
revoke all on public.vayunetra_reports from authenticated;

-- Authenticated operators may read through an explicit RLS policy.
grant select on public.vayunetra_reports to authenticated;

-- Server-side persistence uses the Supabase service role.
grant all on public.vayunetra_reports to service_role;

-- Remove all previous policies on this table regardless of their names.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vayunetra_reports'
  loop
    execute format(
      'drop policy %I on public.vayunetra_reports',
      existing_policy.policyname
    );
  end loop;
end $$;

create policy vayunetra_reports_operator_read
  on public.vayunetra_reports
  for select
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operator'
  );

commit;