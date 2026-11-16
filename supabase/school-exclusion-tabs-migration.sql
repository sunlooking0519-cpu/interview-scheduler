-- Install before deploying school tabs and exclusion controls.
-- Existing schools, assignments, and contact history remain intact.
begin;

alter table scheduler.schools
  add column if not exists excluded_at timestamptz,
  add column if not exists excluded_by uuid references auth.users(id) on delete set null,
  add column if not exists last_activity_at timestamptz;

update scheduler.schools s set last_activity_at = h.latest_at
from (
  select school_id, max(greatest(created_at, coalesce(edited_at, created_at))) as latest_at
  from scheduler.school_contact_history
  where deleted_at is null
  group by school_id
) h
where s.id = h.school_id and s.last_activity_at is distinct from h.latest_at;

create index if not exists schools_excluded_at_idx on scheduler.schools (excluded_at) where excluded_at is not null;
create index if not exists schools_last_activity_idx on scheduler.schools (last_activity_at desc) where last_activity_at is not null;

create or replace function scheduler.refresh_school_last_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_school_id uuid;
begin
  v_school_id := new.school_id;
  update scheduler.schools s set last_activity_at = (
    select max(greatest(h.created_at, coalesce(h.edited_at, h.created_at)))
    from scheduler.school_contact_history h
    where h.school_id = v_school_id and h.deleted_at is null
  ) where s.id = v_school_id;
  return new;
end;
$$;

drop trigger if exists refresh_school_last_activity on scheduler.school_contact_history;
create trigger refresh_school_last_activity
after insert or update of created_at, edited_at, deleted_at on scheduler.school_contact_history
for each row execute function scheduler.refresh_school_last_activity();
revoke all on function scheduler.refresh_school_last_activity() from public, anon, authenticated;

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
    updated_at = now()
  where id = any(p_school_ids) and (excluded_at is not null) is distinct from p_excluded;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function scheduler.set_school_exclusion(uuid[],boolean) from public, anon;
grant execute on function scheduler.set_school_exclusion(uuid[],boolean) to authenticated;

commit;
notify pgrst, 'reload schema';
