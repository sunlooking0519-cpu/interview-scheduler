-- Make the first-email to second-contact workflow explicit and queryable.
begin;

alter table scheduler.sales_organizations
  add column if not exists last_follow_up_round smallint not null default 0,
  add column if not exists follow_up_status text not null default 'pending',
  add column if not exists next_action_type text,
  add column if not exists next_contact_id uuid;

alter table scheduler.sales_activities
  add column if not exists follow_up_round smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sales_organizations_follow_up_round_check'
      and conrelid = 'scheduler.sales_organizations'::regclass
  ) then
    alter table scheduler.sales_organizations
      add constraint sales_organizations_follow_up_round_check
      check (last_follow_up_round between 0 and 10);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'sales_organizations_follow_up_status_check'
      and conrelid = 'scheduler.sales_organizations'::regclass
  ) then
    alter table scheduler.sales_organizations
      add constraint sales_organizations_follow_up_status_check
      check (follow_up_status in ('pending', 'waiting_reply', 'responded', 'paused', 'done'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'sales_organizations_next_action_type_check'
      and conrelid = 'scheduler.sales_organizations'::regclass
  ) then
    alter table scheduler.sales_organizations
      add constraint sales_organizations_next_action_type_check
      check (next_action_type is null or next_action_type in ('call', 'email', 'visit', 'proposal', 'meeting'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'sales_organizations_next_contact_id_fkey'
      and conrelid = 'scheduler.sales_organizations'::regclass
  ) then
    alter table scheduler.sales_organizations
      add constraint sales_organizations_next_contact_id_fkey
      foreign key (next_contact_id) references scheduler.sales_contacts(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'sales_activities_follow_up_round_check'
      and conrelid = 'scheduler.sales_activities'::regclass
  ) then
    alter table scheduler.sales_activities
      add constraint sales_activities_follow_up_round_check
      check (follow_up_round is null or follow_up_round between 1 and 10);
  end if;
end $$;

create index if not exists sales_organizations_follow_up_queue_idx
  on scheduler.sales_organizations (last_follow_up_round, follow_up_status, next_action_at)
  where stage not in ('won', 'lost');
create index if not exists sales_organizations_next_contact_id_idx
  on scheduler.sales_organizations (next_contact_id)
  where next_contact_id is not null;
create index if not exists sales_activities_follow_up_idx
  on scheduler.sales_activities (organization_id, follow_up_round, occurred_at desc)
  where follow_up_round is not null;
create index if not exists sales_activities_contact_id_idx
  on scheduler.sales_activities (contact_id)
  where contact_id is not null;

create or replace function scheduler.record_sales_activity(
  p_organization_id uuid,
  p_contact_id uuid,
  p_activity_type text,
  p_reaction text,
  p_summary text,
  p_occurred_at timestamptz,
  p_follow_up_round smallint,
  p_follow_up_status text,
  p_next_action text,
  p_next_action_type text,
  p_next_action_at timestamptz,
  p_next_contact_id uuid,
  p_stage text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  activity_id uuid;
begin
  if p_follow_up_round = 1 and p_activity_type <> 'email' then
    raise exception 'The first follow-up must be an email';
  end if;
  if p_contact_id is not null and not exists (
    select 1 from scheduler.sales_contacts
    where id = p_contact_id and organization_id = p_organization_id
  ) then
    raise exception 'Contact does not belong to this organization';
  end if;
  if p_next_contact_id is not null and not exists (
    select 1 from scheduler.sales_contacts
    where id = p_next_contact_id and organization_id = p_organization_id
  ) then
    raise exception 'Next contact does not belong to this organization';
  end if;

  insert into scheduler.sales_activities (
    organization_id, contact_id, activity_type, reaction, summary,
    occurred_at, follow_up_round, created_by
  ) values (
    p_organization_id, p_contact_id, p_activity_type, p_reaction, p_summary,
    p_occurred_at, p_follow_up_round, (select auth.uid())
  )
  returning id into activity_id;

  update scheduler.sales_organizations
  set stage = p_stage,
      last_contact_at = p_occurred_at,
      last_follow_up_round = case
        when p_follow_up_round is null then last_follow_up_round
        else greatest(last_follow_up_round, p_follow_up_round)
      end,
      follow_up_status = coalesce(p_follow_up_status, follow_up_status),
      next_action = p_next_action,
      next_action_type = p_next_action_type,
      next_action_at = p_next_action_at,
      next_contact_id = p_next_contact_id
  where id = p_organization_id;

  if not found then
    raise exception 'Organization not found';
  end if;

  return activity_id;
end;
$$;

revoke all on function scheduler.record_sales_activity(
  uuid, uuid, text, text, text, timestamptz, smallint, text,
  text, text, timestamptz, uuid, text
) from public, anon;
grant execute on function scheduler.record_sales_activity(
  uuid, uuid, text, text, text, timestamptz, smallint, text,
  text, text, timestamptz, uuid, text
) to authenticated;

commit;
