-- Spreadsheet-style sales notes become a structured follow-up workflow.
begin;

alter table scheduler.sales_organizations
  add column if not exists region text,
  add column if not exists source text,
  add column if not exists priority text not null default 'normal',
  add column if not exists interest_tags text[] not null default '{}',
  add column if not exists next_action text,
  add column if not exists next_action_at timestamptz,
  add column if not exists last_contact_at timestamptz,
  add column if not exists lost_reason text;

alter table scheduler.sales_organizations
  drop constraint if exists sales_organizations_priority_check;
alter table scheduler.sales_organizations
  add constraint sales_organizations_priority_check
  check (priority in ('high', 'normal', 'low'));

create table if not exists scheduler.sales_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references scheduler.sales_organizations(id) on delete cascade,
  contact_id uuid references scheduler.sales_contacts(id) on delete set null,
  activity_type text not null check (activity_type in ('visit', 'call', 'email', 'proposal', 'meeting', 'note')),
  reaction text not null default 'neutral' check (reaction in ('interested', 'reviewing', 'waiting', 'neutral', 'no_budget', 'not_interested', 'no_response')),
  summary text not null check (length(trim(summary)) between 1 and 5000),
  occurred_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists sales_organizations_next_action_at_idx
  on scheduler.sales_organizations (next_action_at)
  where next_action_at is not null and stage not in ('won', 'lost');
create index if not exists sales_organizations_stage_updated_idx
  on scheduler.sales_organizations (stage, updated_at desc);
create index if not exists sales_activities_organization_occurred_idx
  on scheduler.sales_activities (organization_id, occurred_at desc);

grant select, insert, update, delete on scheduler.sales_activities to authenticated;
grant select, insert, update, delete on scheduler.sales_activities to service_role;
alter table scheduler.sales_activities enable row level security;

drop policy if exists admin_sales_activities_select on scheduler.sales_activities;
create policy admin_sales_activities_select on scheduler.sales_activities
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin'));
drop policy if exists admin_sales_activities_insert on scheduler.sales_activities;
create policy admin_sales_activities_insert on scheduler.sales_activities
  for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin')
    and created_by = (select auth.uid())
  );
drop policy if exists admin_sales_activities_update on scheduler.sales_activities;
create policy admin_sales_activities_update on scheduler.sales_activities
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin'));
drop policy if exists admin_sales_activities_delete on scheduler.sales_activities;
create policy admin_sales_activities_delete on scheduler.sales_activities
  for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin'));

commit;
