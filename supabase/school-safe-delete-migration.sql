-- Run in the production Supabase SQL Editor before deploying school bulk deletion.
-- This migration only installs functions; it does not delete existing rows.
begin;

create or replace function scheduler.preview_school_deletion(p_school_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_schools jsonb;
  v_fingerprint text;
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('admin', 'super_admin') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  v_count := cardinality(p_school_ids);
  if p_school_ids is null or v_count < 1 or v_count > 25
     or exists (select 1 from unnest(p_school_ids) as x(id) where x.id is null)
     or (select count(distinct id) from unnest(p_school_ids) as x(id)) <> v_count then
    raise exception 'Invalid school selection' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'province', s.province, 'district', s.district,
    'level', s.level, 'assignedTo', u.email, 'contactName', s.contact_name,
    'contactDate', s.contact_date, 'managementUpdatedOn', s.management_updated_on,
    'notes', left(coalesce(s.notes, ''), 500),
    'assignmentHistory', (select count(*) from scheduler.school_assignment_history h where h.school_id = s.id),
    'contactHistory', (select count(*) from scheduler.school_contact_history h where h.school_id = s.id),
    'activeActivities', (select count(*) from scheduler.school_contact_history h where h.school_id = s.id and h.deleted_at is null),
    'revisions', (select count(*) from scheduler.school_contact_history_revisions r where r.school_id = s.id),
    'recentActivities', coalesce((select jsonb_agg(jsonb_build_object(
      'date', a.contact_date, 'method', a.contact_method,
      'summary', a.change_summary, 'note', left(coalesce(a.new_note, ''), 200)
    ) order by a.created_at desc, a.id desc) from (
      select contact_date, contact_method, change_summary, new_note, created_at, id
      from scheduler.school_contact_history
      where school_id = s.id and deleted_at is null
      order by created_at desc, id desc limit 3
    ) a), '[]'::jsonb)
  ) order by s.name, s.id),
  md5(string_agg(jsonb_build_object(
    'school', to_jsonb(s),
    'assignments', coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from scheduler.school_assignment_history h where h.school_id = s.id), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from scheduler.school_contact_history a where a.school_id = s.id), '[]'::jsonb),
    'revisions', coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from scheduler.school_contact_history_revisions r where r.school_id = s.id), '[]'::jsonb)
  )::text, '|' order by s.id))
  into v_schools, v_fingerprint
  from scheduler.schools s
  left join auth.users u on u.id = s.assigned_to
  where s.id = any(p_school_ids);

  if jsonb_array_length(coalesce(v_schools, '[]'::jsonb)) <> v_count then
    raise exception 'School selection changed' using errcode = '40001';
  end if;
  return jsonb_build_object('schools', v_schools, 'fingerprint', v_fingerprint);
end;
$$;

create or replace function scheduler.delete_selected_schools(p_school_ids uuid[], p_fingerprint text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_current jsonb;
  v_deleted integer;
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('admin', 'super_admin') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{32}$' then
    raise exception 'Deletion preview required' using errcode = '22023';
  end if;
  -- Follow-up and assignment functions also lock the parent row before changing children.
  perform id from scheduler.schools where id = any(p_school_ids) order by id for update;
  v_current := scheduler.preview_school_deletion(p_school_ids);
  if v_current->>'fingerprint' <> p_fingerprint then
    raise exception 'School records changed after preview' using errcode = '40001';
  end if;
  delete from scheduler.schools where id = any(p_school_ids);
  get diagnostics v_deleted = row_count;
  v_count := cardinality(p_school_ids);
  if v_deleted <> v_count then
    raise exception 'School selection changed' using errcode = '40001';
  end if;
  return v_deleted;
end;
$$;

revoke all on function scheduler.preview_school_deletion(uuid[]) from public, anon;
revoke all on function scheduler.delete_selected_schools(uuid[], text) from public, anon;
grant execute on function scheduler.preview_school_deletion(uuid[]) to authenticated;
grant execute on function scheduler.delete_selected_schools(uuid[], text) to authenticated;

commit;
notify pgrst, 'reload schema';
