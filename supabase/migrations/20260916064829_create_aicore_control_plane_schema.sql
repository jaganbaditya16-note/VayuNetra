create extension if not exists pgcrypto;

create table if not exists public.ai_tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_tenant_memberships (
  tenant_id uuid not null references public.ai_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.ai_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.ai_tenants(id) on delete cascade,
  request_id text not null,
  event_type text not null check (event_type in ('request','policy','routing','provider','response','security')),
  model_id text,
  blocked boolean not null default false,
  findings_count integer not null default 0 check (findings_count >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost numeric(18,8) check (estimated_cost is null or estimated_cost >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_tenants enable row level security;
alter table public.ai_tenant_memberships enable row level security;
alter table public.ai_audit_events enable row level security;

drop policy if exists "tenant members can view tenant" on public.ai_tenants;
create policy "tenant members can view tenant"
  on public.ai_tenants for select to authenticated
  using (exists (
    select 1 from public.ai_tenant_memberships m
    where m.tenant_id = ai_tenants.id and m.user_id = (select auth.uid())
  ));

drop policy if exists "users can view own memberships" on public.ai_tenant_memberships;
create policy "users can view own memberships"
  on public.ai_tenant_memberships for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "tenant members can read audit events" on public.ai_audit_events;
create policy "tenant members can read audit events"
  on public.ai_audit_events for select to authenticated
  using (exists (
    select 1 from public.ai_tenant_memberships m
    where m.tenant_id = ai_audit_events.tenant_id and m.user_id = (select auth.uid())
  ));

drop policy if exists "tenant members can insert audit events" on public.ai_audit_events;
create policy "tenant members can insert audit events"
  on public.ai_audit_events for insert to authenticated
  with check (exists (
    select 1 from public.ai_tenant_memberships m
    where m.tenant_id = ai_audit_events.tenant_id and m.user_id = (select auth.uid())
  ));

create index if not exists ai_tenant_memberships_user_idx on public.ai_tenant_memberships (user_id, tenant_id);
create index if not exists ai_audit_events_tenant_created_idx on public.ai_audit_events (tenant_id, created_at desc);
create index if not exists ai_audit_events_request_idx on public.ai_audit_events (request_id);;
