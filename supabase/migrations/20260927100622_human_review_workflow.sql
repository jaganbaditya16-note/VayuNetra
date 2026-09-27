-- Human authority workflow and append-only review history.
-- Existing citizen reports and environmental evidence are preserved.
begin;

alter table public.vayunetra_reports
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists assigned_authority text,
  add column if not exists review_notes text,
  add column if not exists resolution_notes text,
  add column if not exists escalated boolean not null default false,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists geography jsonb default '{}'::jsonb;

-- Adopt older workflow labels without dropping or deleting any report.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.vayunetra_reports'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.vayunetra_reports drop constraint %I', c.conname);
  end loop;
end $$;

update public.vayunetra_reports set status = 'under_review' where status in ('reviewed', 'under-review');
update public.vayunetra_reports set status = 'action_needed' where status in ('action-needed', 'action needed');
update public.vayunetra_reports set status = 'reported' where status is null or status not in ('reported','under_review','verified','action_needed','resolved','rejected');
alter table public.vayunetra_reports alter column status set default 'reported';
alter table public.vayunetra_reports add constraint vayunetra_reports_workflow_status_check
  check (status in ('reported','under_review','verified','action_needed','resolved','rejected'));
alter table public.vayunetra_reports add constraint vayunetra_reports_verification_status_check
  check (verification_status in ('unverified','authority_verified','authority_rejected'));

create table if not exists public.vayunetra_report_review_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.vayunetra_reports(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  previous_status text not null,
  next_status text not null check (next_status in ('reported','under_review','verified','action_needed','resolved','rejected')),
  event_at timestamptz not null,
  review_notes text,
  resolution_notes text,
  assigned_authority text,
  escalated boolean not null default false,
  event_signature text not null check (event_signature ~ '^[0-9a-f]{64}$')
);
create index if not exists vayunetra_report_review_events_report_idx on public.vayunetra_report_review_events(report_id, event_at desc);
alter table public.vayunetra_report_review_events enable row level security;
alter table public.vayunetra_report_review_events force row level security;
revoke all on public.vayunetra_report_review_events from public, anon, authenticated;
grant all on public.vayunetra_report_review_events to service_role;

create or replace function public.apply_report_review(
  p_report_id uuid, p_actor_id uuid, p_expected_status text, p_new_status text,
  p_review_notes text, p_resolution_notes text, p_assigned_authority text,
  p_escalated boolean, p_event_at timestamptz, p_event_signature text
) returns void language plpgsql security definer set search_path = '' as $$
declare current_status text;
begin
  select status into current_status from public.vayunetra_reports where id = p_report_id for update;
  if current_status is null or current_status <> p_expected_status then raise exception 'concurrent report update'; end if;
  if not (
    (current_status = 'reported' and p_new_status in ('under_review','rejected')) or
    (current_status = 'under_review' and p_new_status in ('verified','action_needed','rejected')) or
    (current_status = 'verified' and p_new_status in ('under_review','action_needed','resolved','rejected')) or
    (current_status = 'action_needed' and p_new_status in ('under_review','resolved','rejected')) or
    (current_status in ('resolved','rejected') and p_new_status = 'under_review')
  ) then raise exception 'invalid report status transition'; end if;
  perform set_config('vayunetra.review_workflow', 'authorized', true);
  update public.vayunetra_reports set
    status = p_new_status,
    verification_status = case when p_new_status = 'verified' then 'authority_verified' when p_new_status = 'rejected' then 'authority_rejected' else verification_status end,
    assigned_authority = p_assigned_authority,
    review_notes = p_review_notes,
    resolution_notes = p_resolution_notes,
    escalated = p_escalated,
    reviewed_at = p_event_at,
    resolved_at = case when p_new_status = 'resolved' then p_event_at else null end
    where id = p_report_id;
  insert into public.vayunetra_report_review_events(report_id, actor_id, previous_status, next_status, event_at, review_notes, resolution_notes, assigned_authority, escalated, event_signature)
    values (p_report_id, p_actor_id, current_status, p_new_status, p_event_at, p_review_notes, p_resolution_notes, p_assigned_authority, p_escalated, p_event_signature);
end $$;

create or replace function public.prevent_direct_report_status_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status and
     current_setting('vayunetra.review_workflow', true) is distinct from 'authorized' then
    raise exception 'report status changes must use the review workflow';
  end if;
  return new;
end $$;
revoke all on function public.prevent_direct_report_status_change() from public, anon, authenticated;
drop trigger if exists vayunetra_reports_status_workflow_guard on public.vayunetra_reports;
create trigger vayunetra_reports_status_workflow_guard
  before update of status on public.vayunetra_reports
  for each row execute function public.prevent_direct_report_status_change();

create or replace function public.guard_report_review_event_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' or current_setting('vayunetra.review_workflow', true) is distinct from 'authorized' then
    raise exception 'review events are append-only and must use the review workflow';
  end if;
  return new;
end $$;
revoke all on function public.guard_report_review_event_write() from public, anon, authenticated;
drop trigger if exists vayunetra_review_events_append_only on public.vayunetra_report_review_events;
create trigger vayunetra_review_events_append_only
  before insert or update or delete on public.vayunetra_report_review_events
  for each row execute function public.guard_report_review_event_write();

revoke all on function public.apply_report_review(uuid,uuid,text,text,text,text,text,boolean,timestamptz,text) from public, anon, authenticated;
grant execute on function public.apply_report_review(uuid,uuid,text,text,text,text,text,boolean,timestamptz,text) to service_role;

commit;
