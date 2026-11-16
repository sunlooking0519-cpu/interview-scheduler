-- Mark schools for another class proposal without removing their assignment or activity history.
begin;

alter table scheduler.schools
  add column if not exists additional_proposal_at timestamptz,
  add column if not exists additional_proposal_by uuid references auth.users(id) on delete set null;

create index if not exists schools_additional_proposal_idx
  on scheduler.schools (additional_proposal_at desc)
  where additional_proposal_at is not null;

create or replace function scheduler.set_school_additional_proposal(p_school_ids uuid[], p_enabled boolean)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_found integer;
  v_changed integer;
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('admin', 'super_admin') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  v_count := cardinality(p_school_ids);
  if p_enabled is null or p_school_ids is null or v_count < 1 or v_count > 25
     or exists (select 1 from unnest(p_school_ids) as x(id) where x.id is null)
     or (select count(distinct id) from unnest(p_school_ids) as x(id)) <> v_count then
    raise exception 'Invalid school selection' using errcode = '22023';
  end if;
  select count(*) into v_found from (
    select id from scheduler.schools where id = any(p_school_ids) order by id for update
  ) locked;
  if v_found <> v_count then
    raise exception 'School selection changed' using errcode = '40001';
  end if;
  update scheduler.schools set
    additional_proposal_at = case when p_enabled then now() else null end,
    additional_proposal_by = case when p_enabled then auth.uid() else null end,
    excluded_at = case when p_enabled then null else excluded_at end,
    excluded_by = case when p_enabled then null else excluded_by end,
    updated_at = now()
  where id = any(p_school_ids)
    and ((additional_proposal_at is not null) is distinct from p_enabled
      or (p_enabled and excluded_at is not null));
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function scheduler.set_school_additional_proposal(uuid[],boolean) from public, anon;
grant execute on function scheduler.set_school_additional_proposal(uuid[],boolean) to authenticated;

-- Moving a school to Excluded also clears its additional-proposal designation.
create or replace function scheduler.set_school_exclusion(p_school_ids uuid[], p_excluded boolean)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_found integer;
  v_changed integer;
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('admin', 'super_admin') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  v_count := cardinality(p_school_ids);
  if p_excluded is null or p_school_ids is null or v_count < 1 or v_count > 25
     or exists (select 1 from unnest(p_school_ids) as x(id) where x.id is null)
     or (select count(distinct id) from unnest(p_school_ids) as x(id)) <> v_count then
    raise exception 'Invalid school selection' using errcode = '22023';
  end if;
  select count(*) into v_found from (
    select id from scheduler.schools where id = any(p_school_ids) order by id for update
  ) locked;
  if v_found <> v_count then
    raise exception 'School selection changed' using errcode = '40001';
  end if;
  update scheduler.schools set
    excluded_at = case when p_excluded then now() else null end,
    excluded_by = case when p_excluded then auth.uid() else null end,
    additional_proposal_at = case when p_excluded then null else additional_proposal_at end,
    additional_proposal_by = case when p_excluded then null else additional_proposal_by end,
    updated_at = now()
  where id = any(p_school_ids)
    and ((excluded_at is not null) is distinct from p_excluded
      or (p_excluded and additional_proposal_at is not null));
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function scheduler.set_school_exclusion(uuid[],boolean) from public, anon;
grant execute on function scheduler.set_school_exclusion(uuid[],boolean) to authenticated;

commit;
notify pgrst, 'reload schema';
