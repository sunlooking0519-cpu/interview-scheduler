-- Run once in the Supabase SQL Editor before deploying instructor sales access.
-- Existing organizations stay with the account that created them. Top administrators can see all workspaces.
begin;

create table if not exists scheduler.sales_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id),
  created_at timestamptz not null default now()
);
alter table scheduler.sales_workspaces enable row level security;
revoke all on scheduler.sales_workspaces from anon, authenticated;
grant select on scheduler.sales_workspaces to authenticated;
drop policy if exists sales_workspaces_read on scheduler.sales_workspaces;
create policy sales_workspaces_read on scheduler.sales_workspaces for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin')
    or ((auth.jwt() -> 'app_metadata' ->> 'role') = 'instructor' and owner_user_id = auth.uid()));

create or replace function scheduler.current_sales_workspace_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from scheduler.sales_workspaces where owner_user_id = (select auth.uid());
$$;
revoke all on function scheduler.current_sales_workspace_id() from public, anon;
grant execute on function scheduler.current_sales_workspace_id() to authenticated;

alter table scheduler.sales_organizations add column if not exists workspace_id uuid references scheduler.sales_workspaces(id);
insert into scheduler.sales_workspaces(owner_user_id)
  select distinct created_by from scheduler.sales_organizations
  on conflict (owner_user_id) do nothing;
update scheduler.sales_organizations o set workspace_id = w.id
  from scheduler.sales_workspaces w where o.created_by = w.owner_user_id and o.workspace_id is null;
alter table scheduler.sales_organizations alter column workspace_id set not null;
alter table scheduler.sales_organizations alter column workspace_id drop default;
create or replace function scheduler.assign_sales_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is not null and new.created_by <> (select auth.uid()) then
    raise exception 'Sales workspace owner mismatch' using errcode = '42501';
  end if;
  insert into scheduler.sales_workspaces(owner_user_id) values (new.created_by)
    on conflict (owner_user_id) do update set owner_user_id = excluded.owner_user_id
    returning id into v_id;
  if new.workspace_id is not null and new.workspace_id <> v_id then
    raise exception 'Sales workspace mismatch' using errcode = '42501';
  end if;
  new.workspace_id := v_id;
  return new;
end;
$$;
drop trigger if exists assign_sales_workspace on scheduler.sales_organizations;
create trigger assign_sales_workspace before insert on scheduler.sales_organizations
  for each row execute function scheduler.assign_sales_workspace();
create index if not exists sales_organizations_workspace_idx
  on scheduler.sales_organizations(workspace_id, updated_at desc);
create or replace function scheduler.keep_sales_workspace_owner()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.workspace_id is distinct from old.workspace_id or new.created_by is distinct from old.created_by then
    raise exception 'Sales workspace ownership cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists keep_sales_workspace_owner on scheduler.sales_organizations;
create trigger keep_sales_workspace_owner before update on scheduler.sales_organizations
  for each row execute function scheduler.keep_sales_workspace_owner();

-- Institution names are unique inside one manager's workspace, not across all managers.
drop index if exists scheduler.sales_organizations_normalized_name_key;
create unique index if not exists sales_organizations_workspace_name_key
  on scheduler.sales_organizations(workspace_id, lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));
create or replace function scheduler.find_sales_organization(p_name text)
returns uuid language sql stable security invoker set search_path = '' as $$
  select id from scheduler.sales_organizations
  where workspace_id = scheduler.current_sales_workspace_id()
    and lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) =
      lower(regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g'))
  order by created_at, id limit 1;
$$;

-- INSERT's BEFORE trigger can create the first workspace in the same statement.
-- STABLE functions use the statement's original snapshot and miss that row.
create or replace function scheduler.is_sales_workspace_member(p_workspace_id uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
  select case
    when (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin') then true
    when (auth.jwt() -> 'app_metadata' ->> 'role') = 'instructor' then exists (
      select 1 from scheduler.sales_workspaces where id = p_workspace_id and owner_user_id = (select auth.uid()))
    else false end;
$$;
create or replace function scheduler.can_access_sales_organization(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from scheduler.sales_organizations o
    where o.id = p_organization_id and scheduler.is_sales_workspace_member(o.workspace_id));
$$;
create or replace function scheduler.can_access_sales_proposal(p_proposal_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from scheduler.sales_proposals p
    where p.id = p_proposal_id and scheduler.can_access_sales_organization(p.organization_id));
$$;
revoke all on function scheduler.is_sales_workspace_member(uuid), scheduler.can_access_sales_organization(uuid), scheduler.can_access_sales_proposal(uuid) from public, anon;
grant execute on function scheduler.is_sales_workspace_member(uuid), scheduler.can_access_sales_organization(uuid), scheduler.can_access_sales_proposal(uuid) to authenticated;

-- Remove old permissive admin policies before installing tenant-scoped policies.
do $$
declare t text; p record;
begin
  foreach t in array array['sales_organizations','sales_contacts','sales_business_cards','sales_activities',
    'sales_meetings','sales_proposals','sales_proposal_versions','sales_activity_revisions'] loop
    for p in select policyname from pg_policies where schemaname = 'scheduler' and tablename = t loop
      execute format('drop policy %I on scheduler.%I', p.policyname, t);
    end loop;
  end loop;
end $$;
create policy sales_organizations_select on scheduler.sales_organizations for select to authenticated
  using (scheduler.is_sales_workspace_member(workspace_id));
create policy sales_organizations_insert on scheduler.sales_organizations for insert to authenticated
  with check (scheduler.is_sales_workspace_member(workspace_id) and created_by = (select auth.uid()));
create policy sales_organizations_update on scheduler.sales_organizations for update to authenticated
  using (scheduler.is_sales_workspace_member(workspace_id)) with check (scheduler.is_sales_workspace_member(workspace_id));
create policy sales_organizations_delete on scheduler.sales_organizations for delete to authenticated
  using (scheduler.is_sales_workspace_member(workspace_id));

do $$
declare t text;
begin
  foreach t in array array['sales_contacts','sales_business_cards','sales_meetings','sales_proposals','sales_activity_revisions'] loop
    execute format('create policy sales_tenant_select on scheduler.%I for select to authenticated using (scheduler.can_access_sales_organization(organization_id))', t);
    execute format('create policy sales_tenant_insert on scheduler.%I for insert to authenticated with check (scheduler.can_access_sales_organization(organization_id))', t);
    execute format('create policy sales_tenant_update on scheduler.%I for update to authenticated using (scheduler.can_access_sales_organization(organization_id)) with check (scheduler.can_access_sales_organization(organization_id))', t);
    execute format('create policy sales_tenant_delete on scheduler.%I for delete to authenticated using (scheduler.can_access_sales_organization(organization_id))', t);
  end loop;
end $$;
create policy sales_tenant_select on scheduler.sales_activities for select to authenticated
  using (scheduler.can_access_sales_organization(organization_id));
create policy sales_tenant_insert on scheduler.sales_activities for insert to authenticated
  with check (scheduler.can_access_sales_organization(organization_id) and created_by = (select auth.uid()));
create policy sales_tenant_update on scheduler.sales_activities for update to authenticated
  using (scheduler.can_access_sales_organization(organization_id))
  with check (scheduler.can_access_sales_organization(organization_id));
create policy sales_tenant_delete on scheduler.sales_activities for delete to authenticated
  using (scheduler.can_access_sales_organization(organization_id));
create policy sales_versions_select on scheduler.sales_proposal_versions for select to authenticated
  using (scheduler.can_access_sales_proposal(proposal_id));

-- The signed URL API checks storage.objects SELECT RLS. New images upload before the organization row is created.
create or replace function scheduler.can_access_sales_card_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_organization_id uuid;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') not in ('admin', 'super_admin', 'instructor') then return false; end if;
  if p_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.(jpg|png|webp)$' then return false; end if;
  select organization_id into v_organization_id from scheduler.sales_business_cards where image_path = p_name;
  if found then return scheduler.can_access_sales_organization(v_organization_id); end if;
  v_organization_id := split_part(p_name, '/', 1)::uuid;
  if exists (select 1 from scheduler.sales_organizations where id = v_organization_id) then
    return scheduler.can_access_sales_organization(v_organization_id);
  end if;
  -- Unlinked uploads are temporary; their UUID path is unguessable and the API deletes failed uploads.
  return true;
end;
$$;
revoke all on function scheduler.can_access_sales_card_path(text) from public, anon;
grant execute on function scheduler.can_access_sales_card_path(text) to authenticated;
drop policy if exists sales_cards_admin_read on storage.objects;
drop policy if exists sales_cards_admin_insert on storage.objects;
drop policy if exists sales_cards_admin_delete on storage.objects;
drop policy if exists sales_cards_staff_read on storage.objects;
drop policy if exists sales_cards_staff_insert on storage.objects;
drop policy if exists sales_cards_staff_delete on storage.objects;
create policy sales_cards_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'sales-cards' and scheduler.can_access_sales_card_path(name));
create policy sales_cards_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sales-cards' and scheduler.can_access_sales_card_path(name));
create policy sales_cards_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sales-cards' and scheduler.can_access_sales_card_path(name));
-- A restrictive fence also blocks unrelated permissive Storage policies from exposing cards.
drop policy if exists sales_cards_tenant_read on storage.objects;
drop policy if exists sales_cards_tenant_insert on storage.objects;
drop policy if exists sales_cards_tenant_update on storage.objects;
drop policy if exists sales_cards_tenant_delete on storage.objects;
create policy sales_cards_tenant_read on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'sales-cards' or scheduler.can_access_sales_card_path(name));
create policy sales_cards_tenant_insert on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'sales-cards' or scheduler.can_access_sales_card_path(name));
create policy sales_cards_tenant_update on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'sales-cards' or scheduler.can_access_sales_card_path(name))
  with check (bucket_id <> 'sales-cards' or scheduler.can_access_sales_card_path(name));
create policy sales_cards_tenant_delete on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'sales-cards' or scheduler.can_access_sales_card_path(name));

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
  if not scheduler.can_access_sales_organization(p_organization_id) then
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

commit;
notify pgrst, 'reload schema';
