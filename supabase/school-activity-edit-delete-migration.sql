-- Apply before deploying school activity edit/delete. Existing activity rows remain visible.
begin;

alter table scheduler.school_contact_history
  add column if not exists edit_version integer not null default 0,
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by uuid,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

create table if not exists scheduler.school_contact_history_revisions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  school_id uuid not null references scheduler.schools(id) on delete cascade,
  action text not null check (action in ('edit', 'delete')),
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  before_data jsonb not null,
  after_data jsonb not null
);
create index if not exists school_contact_revisions_school_idx
  on scheduler.school_contact_history_revisions (school_id, changed_at desc);
alter table scheduler.school_contact_history_revisions enable row level security;
grant all on scheduler.school_contact_history_revisions to service_role;

-- Keep soft-deleted records out of every normal authenticated read, including aggregates.
drop policy if exists school_contact_history_select on scheduler.school_contact_history;
create policy school_contact_history_select on scheduler.school_contact_history for select to authenticated using (
  deleted_at is null and (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin')
    or ((auth.jwt() -> 'app_metadata' ->> 'role') = 'instructor' and exists (
      select 1 from scheduler.schools s where s.id = school_id and s.assigned_to = (select auth.uid())
    ))
  )
);

create or replace function scheduler.refresh_school_contact_state(p_school_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_latest scheduler.school_contact_history%rowtype;
  v_notes text;
begin
  select * into v_latest from scheduler.school_contact_history
  where school_id = p_school_id and deleted_at is null
  order by created_at desc, id desc limit 1;
  select string_agg(new_note, E'\n\n' order by created_at, id) into v_notes
  from scheduler.school_contact_history
  where school_id = p_school_id and deleted_at is null and nullif(btrim(new_note), '') is not null;
  update scheduler.schools set
    contact_date = v_latest.contact_date,
    contact_name = v_latest.contact_name,
    contact_email = v_latest.contact_email,
    contact_phone = v_latest.contact_phone,
    contact_method = v_latest.contact_method,
    proposal_status = v_latest.proposal_status,
    reaction = v_latest.reaction,
    notes = v_notes,
    management_updated_on = v_latest.update_date,
    updated_at = now()
  where id = p_school_id;
end;
$$;
revoke all on function scheduler.refresh_school_contact_state(uuid) from public, anon, authenticated;

create or replace function scheduler.edit_school_contact_activity(
  p_activity_id uuid, p_school_id uuid, p_expected_version integer,
  p_contact_date date, p_update_date date, p_contact_name text,
  p_contact_email text, p_contact_phone text, p_contact_method text,
  p_proposal_status text, p_reaction text, p_new_note text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_school scheduler.schools%rowtype;
  v_activity scheduler.school_contact_history%rowtype;
  v_before jsonb;
  v_role text := auth.jwt() -> 'app_metadata' ->> 'role';
  v_name text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_email text := nullif(btrim(coalesce(p_contact_email, '')), '');
  v_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_note text := nullif(btrim(coalesce(p_new_note, '')), '');
begin
  if auth.uid() is null or coalesce(v_role, '') not in ('admin', 'super_admin', 'instructor') then
    raise exception 'School access required' using errcode = '42501';
  end if;
  if p_activity_id is null or p_school_id is null or p_expected_version is null or p_expected_version < 0
     or p_contact_date is null or p_update_date is null
     or p_contact_date > (now() at time zone 'Asia/Seoul')::date
     or p_update_date > (now() at time zone 'Asia/Seoul')::date
     or p_update_date < p_contact_date
     or length(coalesce(v_name, '')) > 120 or length(coalesce(v_email, '')) > 200
     or length(coalesce(v_phone, '')) > 80
     or (v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
     or p_contact_method is null or p_contact_method not in ('visit', 'call', 'email', 'referral')
     or (p_proposal_status is not null and p_proposal_status not in ('not_submitted', 'planned', 'submitted'))
     or (p_reaction is not null and p_reaction not in ('interested', 'reviewing', 'waiting', 'neutral', 'no_budget', 'not_interested', 'no_response'))
     or length(coalesce(v_note, '')) > 5000 then
    raise exception 'Invalid school activity correction' using errcode = '22023';
  end if;
  select * into v_school from scheduler.schools where id = p_school_id for update;
  if not found or (v_role = 'instructor' and v_school.assigned_to is distinct from auth.uid()) then
    raise exception 'School is not assigned to this manager' using errcode = '42501';
  end if;
  select * into v_activity from scheduler.school_contact_history
  where id = p_activity_id and school_id = p_school_id and deleted_at is null for update;
  if not found then raise exception 'School activity not found' using errcode = 'P0002'; end if;
  if v_activity.edit_version <> p_expected_version then
    raise exception 'School activity changed' using errcode = '40001';
  end if;
  if v_activity.contact_date is not distinct from p_contact_date
     and v_activity.update_date is not distinct from p_update_date
     and v_activity.contact_name is not distinct from v_name
     and v_activity.contact_email is not distinct from v_email
     and v_activity.contact_phone is not distinct from v_phone
     and v_activity.contact_method is not distinct from p_contact_method
     and v_activity.proposal_status is not distinct from p_proposal_status
     and v_activity.reaction is not distinct from p_reaction
     and v_activity.new_note is not distinct from v_note then return false; end if;
  v_before := to_jsonb(v_activity);
  update scheduler.school_contact_history set
    contact_date = p_contact_date, update_date = p_update_date,
    contact_name = v_name, contact_email = v_email, contact_phone = v_phone,
    contact_method = p_contact_method, proposal_status = p_proposal_status,
    reaction = p_reaction, new_note = v_note, change_summary = '기록 수정',
    edit_version = edit_version + 1, edited_at = now(), edited_by = auth.uid()
  where id = p_activity_id;
  insert into scheduler.school_contact_history_revisions
    (activity_id, school_id, action, changed_by, before_data, after_data)
  select id, school_id, 'edit', auth.uid(), v_before, to_jsonb(h)
  from scheduler.school_contact_history h where h.id = p_activity_id;
  perform scheduler.refresh_school_contact_state(p_school_id);
  return true;
end;
$$;
revoke all on function scheduler.edit_school_contact_activity(uuid,uuid,integer,date,date,text,text,text,text,text,text,text) from public, anon;
grant execute on function scheduler.edit_school_contact_activity(uuid,uuid,integer,date,date,text,text,text,text,text,text,text) to authenticated;

create or replace function scheduler.delete_school_contact_activity(
  p_activity_id uuid, p_school_id uuid, p_expected_version integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_school scheduler.schools%rowtype;
  v_activity scheduler.school_contact_history%rowtype;
  v_role text := auth.jwt() -> 'app_metadata' ->> 'role';
begin
  if auth.uid() is null or coalesce(v_role, '') not in ('admin', 'super_admin', 'instructor') then
    raise exception 'School access required' using errcode = '42501';
  end if;
  if p_activity_id is null or p_school_id is null or p_expected_version is null or p_expected_version < 0 then
    raise exception 'Invalid school activity deletion' using errcode = '22023';
  end if;
  select * into v_school from scheduler.schools where id = p_school_id for update;
  if not found or (v_role = 'instructor' and v_school.assigned_to is distinct from auth.uid()) then
    raise exception 'School is not assigned to this manager' using errcode = '42501';
  end if;
  select * into v_activity from scheduler.school_contact_history
  where id = p_activity_id and school_id = p_school_id and deleted_at is null for update;
  if not found then raise exception 'School activity not found' using errcode = 'P0002'; end if;
  if v_activity.edit_version <> p_expected_version then
    raise exception 'School activity changed' using errcode = '40001';
  end if;
  update scheduler.school_contact_history set
    deleted_at = now(), deleted_by = auth.uid(), edit_version = edit_version + 1
  where id = p_activity_id;
  insert into scheduler.school_contact_history_revisions
    (activity_id, school_id, action, changed_by, before_data, after_data)
  select id, school_id, 'delete', auth.uid(), to_jsonb(v_activity), to_jsonb(h)
  from scheduler.school_contact_history h where h.id = p_activity_id;
  perform scheduler.refresh_school_contact_state(p_school_id);
  return true;
end;
$$;
revoke all on function scheduler.delete_school_contact_activity(uuid,uuid,integer) from public, anon;
grant execute on function scheduler.delete_school_contact_activity(uuid,uuid,integer) to authenticated;

commit;
notify pgrst, 'reload schema';
