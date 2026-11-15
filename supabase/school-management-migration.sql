-- Apply in the production Supabase SQL Editor before importing school data.
begin;

create table if not exists scheduler.schools (
  id uuid primary key default gen_random_uuid(),
  education_office_code text not null,
  school_code text not null,
  province text not null,
  district text not null,
  level text not null check (level in ('초등학교', '중학교', '고등학교')),
  name text not null,
  phone text not null,
  source_loaded_on date,
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_at timestamptz,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schools_source_key unique (education_office_code, school_code, level)
);
create index if not exists schools_filters_idx on scheduler.schools (province, district, level, name);
create index if not exists schools_assigned_to_idx on scheduler.schools (assigned_to, province, district);
create index if not exists schools_name_idx on scheduler.schools (name);

create table if not exists scheduler.school_assignment_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references scheduler.schools(id) on delete cascade,
  previous_assignee uuid,
  new_assignee uuid,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);
create index if not exists school_assignment_history_school_idx
  on scheduler.school_assignment_history (school_id, changed_at desc);

alter table scheduler.schools enable row level security;
alter table scheduler.school_assignment_history enable row level security;
grant usage on schema scheduler to authenticated;
grant select on scheduler.schools to authenticated;
revoke update on scheduler.schools from authenticated;
grant select on scheduler.school_assignment_history to authenticated;
grant all on scheduler.schools, scheduler.school_assignment_history to service_role;

drop policy if exists schools_select on scheduler.schools;
create policy schools_select on scheduler.schools for select to authenticated using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin')
  or ((auth.jwt() -> 'app_metadata' ->> 'role') = 'instructor' and assigned_to = (select auth.uid()))
);
drop policy if exists schools_update on scheduler.schools;
drop policy if exists school_assignment_history_select on scheduler.school_assignment_history;
create policy school_assignment_history_select on scheduler.school_assignment_history
  for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin'));

create or replace function scheduler.assign_schools(p_school_ids uuid[], p_assignee_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_unique_count integer;
  v_found_count integer;
  v_changed_count integer;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') not in ('admin', 'super_admin')
    or auth.uid() is null then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  select count(*) into v_unique_count from (select distinct x.id from unnest(p_school_ids) as x(id)) ids;
  if v_unique_count < 1 or v_unique_count > 5000 or v_unique_count <> cardinality(p_school_ids)
    or exists (select 1 from unnest(p_school_ids) as x(id) where x.id is null) then
    raise exception 'Invalid school selection' using errcode = '22023';
  end if;
  if p_assignee_id is not null and not exists (
    select 1 from auth.users u where u.id = p_assignee_id
      and u.raw_app_meta_data->>'role' in ('admin', 'super_admin', 'instructor')
  ) then
    raise exception 'Assignee is not an approved manager' using errcode = '22023';
  end if;
  select count(*) into v_found_count from (
    select id from scheduler.schools where id = any(p_school_ids) for update
  ) locked;
  if v_found_count <> v_unique_count then
    raise exception 'School selection changed' using errcode = '40001';
  end if;

  insert into scheduler.school_assignment_history (school_id, previous_assignee, new_assignee, changed_by)
  select id, assigned_to, p_assignee_id, auth.uid()
  from scheduler.schools where id = any(p_school_ids) and assigned_to is distinct from p_assignee_id;
  update scheduler.schools set
    assigned_to = p_assignee_id,
    assigned_at = case when p_assignee_id is null then null else now() end,
    assigned_by = auth.uid(),
    updated_at = now()
  where id = any(p_school_ids) and assigned_to is distinct from p_assignee_id;
  get diagnostics v_changed_count = row_count;
  return v_changed_count;
end;
$$;
revoke all on function scheduler.assign_schools(uuid[], uuid) from public, anon;
grant execute on function scheduler.assign_schools(uuid[], uuid) to authenticated;

commit;
notify pgrst, 'reload schema';
