-- Run once in the Supabase SQL Editor before using timeline editing.
-- Activity corrections are versioned; follow-up round and next-action fields remain unchanged.
begin;

alter table scheduler.sales_activities
  add column if not exists edit_version integer not null default 0,
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by uuid;

create table if not exists scheduler.sales_activity_revisions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  organization_id uuid not null references scheduler.sales_organizations(id) on delete cascade,
  version integer not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id),
  changed_by_email text,
  before_data jsonb not null,
  after_data jsonb not null,
  unique (activity_id, version)
);

create index if not exists sales_activity_revisions_organization_idx
  on scheduler.sales_activity_revisions (organization_id, changed_at desc);
create index if not exists sales_activity_revisions_activity_idx
  on scheduler.sales_activity_revisions (activity_id, changed_at desc);

grant select on scheduler.sales_activity_revisions to authenticated;
alter table scheduler.sales_activity_revisions enable row level security;
drop policy if exists admin_sales_activity_revisions_select on scheduler.sales_activity_revisions;
create policy admin_sales_activity_revisions_select on scheduler.sales_activity_revisions
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin'));

create or replace function scheduler.version_sales_activity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.edit_version := old.edit_version + 1;
  new.edited_at := now();
  new.edited_by := auth.uid();
  return new;
end;
$$;

create or replace function scheduler.audit_sales_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into scheduler.sales_activity_revisions (
    activity_id, organization_id, version, changed_at, changed_by, changed_by_email, before_data, after_data
  ) values (
    new.id, new.organization_id, new.edit_version, new.edited_at, new.edited_by,
    auth.jwt() ->> 'email',
    to_jsonb(old), to_jsonb(new)
  );
  return null;
end;
$$;

drop trigger if exists version_sales_activity on scheduler.sales_activities;
create trigger version_sales_activity before update on scheduler.sales_activities
for each row execute function scheduler.version_sales_activity();
drop trigger if exists audit_sales_activity on scheduler.sales_activities;
create trigger audit_sales_activity after update on scheduler.sales_activities
for each row execute function scheduler.audit_sales_activity();

create or replace function scheduler.edit_sales_activity(
  p_activity_id uuid,
  p_organization_id uuid,
  p_expected_version integer,
  p_contact_id uuid,
  p_occurred_at timestamptz,
  p_reaction text,
  p_summary text,
  p_visit_region text,
  p_proposal_status text,
  p_contact_method text,
  p_management_updated_on date
)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_activity scheduler.sales_activities%rowtype;
  v_version integer;
  v_last_contact_at timestamptz;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') not in ('admin', 'super_admin') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_expected_version is null or p_expected_version < 0
    or p_occurred_at is null or p_reaction is null or p_reaction not in
    ('interested', 'reviewing', 'waiting', 'neutral', 'no_budget', 'not_interested', 'no_response')
    or p_summary is null or length(trim(p_summary)) not between 1 and 5000
    or (p_visit_region is not null and length(trim(p_visit_region)) > 120)
    or (p_proposal_status is not null and p_proposal_status not in ('not_submitted', 'planned', 'submitted'))
    or (p_contact_method is not null and p_contact_method not in ('visit', 'call', 'email', 'referral')) then
    raise exception 'Invalid activity correction' using errcode = '22023';
  end if;
  select * into v_activity from scheduler.sales_activities
    where id = p_activity_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Activity not found' using errcode = 'P0002'; end if;
  if v_activity.edit_version <> p_expected_version then
    raise exception 'Activity changed by another administrator' using errcode = '40001';
  end if;
  if v_activity.activity_type <> 'visit' and p_contact_method is distinct from v_activity.contact_method then
    raise exception 'Activity type must be corrected with a new record' using errcode = '22023';
  end if;
  if p_contact_id is not null and not exists (
    select 1 from scheduler.sales_contacts
    where id = p_contact_id and organization_id = p_organization_id
  ) then raise exception 'Contact does not belong to this organization' using errcode = '22023'; end if;

  update scheduler.sales_activities set
    contact_id = p_contact_id,
    occurred_at = p_occurred_at,
    reaction = p_reaction,
    summary = trim(p_summary),
    visit_region = nullif(trim(p_visit_region), ''),
    proposal_status = p_proposal_status,
    contact_method = p_contact_method,
    management_updated_on = p_management_updated_on
  where id = p_activity_id and organization_id = p_organization_id
  returning edit_version into v_version;

  select max(occurred_at) into v_last_contact_at from scheduler.sales_activities
    where organization_id = p_organization_id;
  update scheduler.sales_organizations set last_contact_at = v_last_contact_at
    where id = p_organization_id and last_contact_at is distinct from v_last_contact_at;
  return v_version;
end;
$$;

revoke all on function scheduler.edit_sales_activity(uuid,uuid,integer,uuid,timestamptz,text,text,text,text,text,date) from public, anon;
grant execute on function scheduler.edit_sales_activity(uuid,uuid,integer,uuid,timestamptz,text,text,text,text,text,date) to authenticated;

commit;
notify pgrst, 'reload schema';
